import type {
  OpeningHour,
  Restaurant,
  RestaurantMember,
  RestaurantRole,
  UUID,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Fiche, horaires et équipe du restaurant.
 *
 * Istanbul est le seul établissement : `restaurantId` circule encore dans ces
 * signatures parce que le schéma porte la colonne (toutes les lignes du
 * catalogue, des commandes et des zones y sont rattachées), mais il n'y a
 * jamais qu'une valeur possible. Rien ici ne filtre « pour faire joli » : la
 * RLS refuse de toute façon les lignes hors périmètre.
 */

// ---------------------------------------------------------------------------
// Fiche de l'établissement
// ---------------------------------------------------------------------------

export async function fetchRestaurantById(restaurantId: UUID): Promise<Restaurant> {
  const { data, error } = await getSupabase()
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single();

  if (error) throw error;
  return data as Restaurant;
}

export type RestaurantPatch = Partial<
  Pick<
    Restaurant,
    | 'name'
    | 'tagline'
    | 'description'
    | 'logo_url'
    | 'cover_url'
    | 'phone'
    | 'email'
    | 'address_line'
    | 'city'
    | 'latitude'
    | 'longitude'
    | 'is_open'
    | 'is_accepting_orders'
    | 'is_published'
    | 'min_order_amount'
    | 'avg_prep_minutes'
    | 'service_fee_bps'
    | 'pickup_enabled'
    | 'delivery_enabled'
  >
>;

export async function saveRestaurant(
  restaurantId: UUID,
  patch: RestaurantPatch,
): Promise<Restaurant> {
  const { data, error } = await getSupabase()
    .from('restaurants')
    .update(patch)
    .eq('id', restaurantId)
    .select()
    .single();

  if (error) throw error;
  return data as Restaurant;
}

// ---------------------------------------------------------------------------
// Horaires
// ---------------------------------------------------------------------------

/** 0 = dimanche … 6 = samedi, l'ordre de `day_of_week` en base. */
export const WEEKDAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

export async function fetchOpeningHours(restaurantId: UUID): Promise<OpeningHour[]> {
  const { data, error } = await getSupabase()
    .from('opening_hours')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('day_of_week');

  if (error) throw error;
  return (data ?? []) as OpeningHour[];
}

/**
 * Enregistre la semaine entière en un `upsert`.
 *
 * La contrainte `unique (restaurant_id, day_of_week)` sert de clé de conflit :
 * pas besoin de savoir si la ligne du mardi existait déjà.
 */
export async function saveOpeningHours(
  restaurantId: UUID,
  week: Pick<OpeningHour, 'day_of_week' | 'opens_at' | 'closes_at' | 'is_closed'>[],
): Promise<void> {
  const { error } = await getSupabase()
    .from('opening_hours')
    .upsert(
      week.map((day) => ({ ...day, restaurant_id: restaurantId })),
      { onConflict: 'restaurant_id,day_of_week' },
    );

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------

export async function fetchRestaurantMembers(restaurantId: UUID): Promise<RestaurantMember[]> {
  const { data, error } = await getSupabase()
    .from('restaurant_members')
    .select('*, profile:profiles ( full_name, email, phone, avatar_url )')
    .eq('restaurant_id', restaurantId)
    .order('created_at');

  if (error) throw error;

  // OWNER puis MANAGER puis STAFF : l'ordre hiérarchique se lit mieux que
  // l'ordre d'arrivée, et le tri SQL sur un enum donnerait l'ordre de
  // déclaration — le même, mais par hasard.
  const rank: Record<RestaurantRole, number> = { OWNER: 0, MANAGER: 1, STAFF: 2 };
  return ((data ?? []) as RestaurantMember[]).sort((a, b) => rank[a.role] - rank[b.role]);
}

/**
 * Rattache une personne existante à l'équipe.
 *
 * On ne crée pas le compte depuis le dashboard : cela exigerait la clé
 * `service_role` dans le navigateur. La personne s'inscrit d'abord depuis
 * l'app client, puis le propriétaire la rattache par son e-mail.
 */
export async function addRestaurantMember(input: {
  restaurantId: UUID;
  email: string;
  role: RestaurantRole;
  jobTitle?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('fn_add_restaurant_member', {
    p_restaurant_id: input.restaurantId,
    p_email: input.email,
    p_role: input.role,
    p_job_title: input.jobTitle ?? null,
  });

  if (error) throw error;
}

export async function setMemberRole(input: {
  restaurantId: UUID;
  profileId: UUID;
  role: RestaurantRole;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('restaurant_members')
    .update({ role: input.role })
    .eq('restaurant_id', input.restaurantId)
    .eq('profile_id', input.profileId);

  if (error) throw error;
}

/** Le serveur refuse le retrait du dernier propriétaire — voir migration 21. */
export async function removeRestaurantMember(input: {
  restaurantId: UUID;
  profileId: UUID;
}): Promise<void> {
  const { error } = await getSupabase().rpc('fn_remove_restaurant_member', {
    p_restaurant_id: input.restaurantId,
    p_profile_id: input.profileId,
  });

  if (error) throw error;
}
