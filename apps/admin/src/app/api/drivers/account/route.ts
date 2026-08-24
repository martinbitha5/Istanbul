import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getDashboardBootstrap } from '@/lib/supabase/server';

/**
 * Création du compte d'un livreur.
 *
 * Pourquoi une route serveur et pas un appel direct depuis la page :
 * `auth.signUp()` ouvre une session pour le compte qu'il vient de créer.
 * Appelé depuis le navigateur, il déconnecterait le gérant et le
 * reconnecterait en tant que son propre livreur — au milieu du service.
 * Ici le client Supabase est construit à la main avec `persistSession: false`
 * et sans cookies : la session créée est jetée avec la requête, celle du
 * gérant n'est jamais touchée.
 *
 * Pourquoi pas la clé `service_role` : elle n'est pas dans ce projet, et c'est
 * délibéré (voir lib/supabase/server.ts). `signUp` avec la clé anon suffit —
 * il crée le compte et le trigger `fn_handle_new_user` pose la ligne
 * `profiles`. La contrepartie est que la création dépend de
 * `enable_signup = true` côté Supabase, et que si les confirmations d'e-mail
 * étaient activées le livreur devrait confirmer avant de se connecter. Les
 * deux réglages sont vérifiables dans supabase/config.toml.
 *
 * La garde n'est pas cosmétique : cette route crée un compte, elle ne doit
 * répondre qu'à un gérant authentifié de l'établissement.
 */
export async function POST(request: Request) {
  const { profile, restaurant, role, isAdmin } = await getDashboardBootstrap();

  if (!profile || !restaurant) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // Mêmes droits que la page Livreurs (`access.manage`).
  const canManage = isAdmin || role === 'OWNER' || role === 'MANAGER';
  if (!canManage) {
    return NextResponse.json(
      { error: 'Seul le propriétaire ou un responsable peut enrôler un livreur.' },
      { status: 403 },
    );
  }

  let body: { email?: string; fullName?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: 'Le nom du livreur est obligatoire.' }, { status: 400 });
  }

  const password = generatePassword();

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        // `fn_handle_new_user` lit ce champ pour remplir `profiles.phone`.
        phone: body.phone?.trim() || null,
      },
    },
  });

  if (error) {
    // Supabase répond « User already registered » : le cas est normal (la
    // personne a déjà commandé comme cliente), la page doit pouvoir le
    // rattraper en rattachant le compte existant.
    const alreadyExists = /already/i.test(error.message);
    return NextResponse.json(
      { error: error.message, alreadyExists },
      { status: alreadyExists ? 409 : 400 },
    );
  }

  if (!data.user) {
    return NextResponse.json(
      { error: 'Le compte n’a pas pu être créé. Vérifiez que les inscriptions sont ouvertes côté Supabase.' },
      { status: 400 },
    );
  }

  // Le mot de passe ne repart qu'ici, une seule fois : il n'est stocké nulle
  // part, et le gérant doit le transmettre au livreur avant de fermer la
  // fenêtre.
  return NextResponse.json({ profileId: data.user.id, email, password });
}

/**
 * Mot de passe temporaire lisible à voix haute.
 *
 * Le gérant va le dicter au livreur par téléphone : l'alphabet exclut les
 * caractères qui s'entendent ou se lisent mal (0/O, 1/l/I) plutôt que de
 * maximiser l'entropie d'un secret qui doit de toute façon être changé.
 */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
