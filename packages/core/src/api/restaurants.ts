import type {
  ManagedRestaurant,
  OpeningHour,
  Restaurant,
  RestaurantBilling,
  RestaurantMember,
  RestaurantRole,
  UUID,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Gestion multi-établissements.
 *
 * Rien ici ne filtre par restaurant « pour faire joli » : la RLS refuse de
 * toute façon les lignes hors périmètre (migration 21). Les `eq()` servent à
 * ne pas rapatrier ce qu'on n'affichera pas, pas à protéger quoi que ce soit.
 */

// ---------------------------------------------------------------------------
// Périmètre de l'utilisateur
// ---------------------------------------------------------------------------

/**
 * Établissements que l'utilisateur peut ouvrir dans le dashboard.
 *
 * Passe par la fonction SQL plutôt que par un `select` sur `restaurants` :
 * la table est en lecture publique (c'est la vitrine), un `select *` y
 * renverrait donc *tous* les partenaires, y compris à un gérant qui n'en
 * administre qu'un.
 */
export async function fetchMyRestaurants(): Promise<ManagedRestaurant[]> {
  const { data, error } = await getSupabase().rpc('fn_my_restaurants');
  if (error) throw error;
  return (data ?? []) as ManagedRestaurant[];
}

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
// Conditions commerciales
// ---------------------------------------------------------------------------

/**
 * Commission du partenaire.
 *
 * Renvoie `null` plutôt qu'une erreur quand la RLS masque la ligne : un membre
 * « Gérant » n'a pas à connaître les conditions négociées, et l'écran doit
 * simplement masquer le champ, pas afficher un message d'échec.
 */
export async function fetchRestaurantBilling(
  restaurantId: UUID,
): Promise<RestaurantBilling | null> {
  const { data, error } = await getSupabase()
    .from('restaurant_billing')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as RestaurantBilling | null) ?? null;
}

/** Réservé à la plateforme — la policy d'écriture refuse tout le reste. */
export async function saveRestaurantBilling(
  restaurantId: UUID,
  patch: Partial<Pick<RestaurantBilling, 'commission_bps' | 'billing_email' | 'billing_note'>>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('restaurant_billing')
    .upsert({ restaurant_id: restaurantId, ...patch }, { onConflict: 'restaurant_id' });

  if (error) throw error;
}

/** Toutes les commissions — la RLS ne sert la table qu'à la plateforme. */
export async function fetchAllBilling(): Promise<RestaurantBilling[]> {
  const { data, error } = await getSupabase().from('restaurant_billing').select('*');
  if (error) throw error;
  return (data ?? []) as RestaurantBilling[];
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

// ---------------------------------------------------------------------------
// Onboarding d'un partenaire (plateforme)
// ---------------------------------------------------------------------------

export interface CreateRestaurantInput {
  name: string;
  phone: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  ownerEmail?: string | null;
  commissionBps?: number;
  city?: string;
}

/**
 * Ouvre un établissement, non publié et fermé aux commandes.
 *
 * Le partenaire monte son menu, règle ses zones, puis publie lui-même. Créer
 * un restaurant déjà visible dans l'app client mettrait en vitrine une carte
 * vide.
 */
export async function createRestaurant(input: CreateRestaurantInput): Promise<Restaurant> {
  const { data, error } = await getSupabase().rpc('fn_create_restaurant', {
    p_name: input.name,
    p_phone: input.phone,
    p_address_line: input.addressLine,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_owner_email: input.ownerEmail ?? null,
    p_commission_bps: input.commissionBps ?? 0,
    p_city: input.city ?? 'Kinshasa',
  });

  if (error) throw error;
  return data as Restaurant;
}

// ---------------------------------------------------------------------------
// Revenus de la plateforme
// ---------------------------------------------------------------------------

export interface PlatformRevenueRow {
  restaurant_id: UUID;
  restaurant_name: string;
  is_published: boolean;
  orders_delivered: number;
  /** Sous-total encaissé sur la période, en centimes. */
  gross_sales: number;
  /** Frais de livraison, reversés aux livreurs — hors assiette de commission. */
  delivery_fees: number;
  commission_bps: number;
  commission_due: number;
  net_to_partner: number;
}

/**
 * Commission due par partenaire sur une période.
 *
 * L'assiette est le sous-total des commandes livrées : ni la livraison (elle
 * va au livreur) ni les frais de service. Le serveur refuse l'appel à qui
 * n'est pas administrateur de la plateforme.
 */
export async function fetchPlatformRevenue(
  from: Date,
  to: Date = new Date(),
): Promise<PlatformRevenueRow[]> {
  const { data, error } = await getSupabase().rpc('fn_platform_revenue', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) throw error;
  return (data ?? []) as PlatformRevenueRow[];
}

/** Tous les partenaires — réservé à l'administration de la plateforme. */
export async function fetchAllRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await getSupabase().from('restaurants').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Restaurant[];
}
