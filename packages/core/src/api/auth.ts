import type { Profile } from '@istanbul/types';
import { getSupabase } from '../supabase/client';
import { toE164 } from '../format';

/**
 * Authentification.
 *
 * Deux voies d'entrée : email + mot de passe, ou téléphone + code OTP.
 * À Kinshasa le téléphone est la voie principale — beaucoup de clients n'ont
 * pas d'adresse email active — mais l'email reste nécessaire pour le staff.
 */

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export async function signUpWithEmail(input: SignUpInput): Promise<void> {
  const { error } = await getSupabase().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone ? toE164(input.phone) : null,
      },
    },
  });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

/** Envoie un code à 6 chiffres par SMS. */
export async function requestPhoneOtp(phone: string): Promise<void> {
  const e164 = toE164(phone);
  if (!e164) throw new Error('Numéro invalide. Format attendu : 0999 000 105.');

  const { error } = await getSupabase().auth.signInWithOtp({ phone: e164 });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<void> {
  const e164 = toE164(phone);
  if (!e164) throw new Error('Numéro invalide.');

  const { error } = await getSupabase().auth.verifyOtp({
    phone: e164,
    token: token.trim(),
    type: 'sms',
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(patch: Partial<Profile>): Promise<Profile> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error('Non connecté.');

  // `role` et `restaurant_id` sont de toute façon rejetés par trg_profiles_guard ;
  // on les retire ici pour éviter un aller-retour inutile.
  const { role: _role, restaurant_id: _restaurant, id: _id, ...safe } = patch;

  const { data, error } = await supabase
    .from('profiles')
    .update(safe)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// Les tokens Expo Push sont gérés dans `api/notifications.ts` : l'append/remove
// passe par une RPC serveur, un update direct de `profiles.push_tokens` depuis
// deux appareils écraserait la liste de l'autre.

/** Upload d'avatar. Chemin imposé par la policy Storage : `<uid>/<fichier>`. */
export async function uploadAvatar(uri: string, fileName: string): Promise<string> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error('Non connecté.');

  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await updateMyProfile({ avatar_url: data.publicUrl });
  return data.publicUrl;
}
