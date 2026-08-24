import type {
  Category,
  DashboardStats,
  DeliveryZone,
  Driver,
  Product,
  ProductOption,
  ProductOptionGroup,
  Profile,
  Promotion,
  SalesPoint,
  TopProduct,
  UUID,
  VehicleType,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Opérations du dashboard restaurant / admin.
 * Toutes protégées par `fn_is_staff()` / `fn_is_admin()` au niveau RLS.
 */

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export async function fetchDashboardStats(
  restaurantId: UUID,
  from?: Date,
  to?: Date,
): Promise<DashboardStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await getSupabase().rpc('fn_dashboard_stats', {
    p_restaurant_id: restaurantId,
    p_from: (from ?? startOfDay).toISOString(),
    p_to: (to ?? new Date()).toISOString(),
  });

  if (error) throw error;
  return data as DashboardStats;
}

export type SalesBucket = 'day' | 'week' | 'month';

export async function fetchSalesSeries(
  restaurantId: UUID,
  bucket: SalesBucket = 'day',
  from?: Date,
  to?: Date,
): Promise<SalesPoint[]> {
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - (bucket === 'day' ? 30 : bucket === 'week' ? 90 : 365));

  const { data, error } = await getSupabase().rpc('fn_sales_series', {
    p_restaurant_id: restaurantId,
    p_bucket: bucket,
    p_from: (from ?? defaultFrom).toISOString(),
    p_to: (to ?? new Date()).toISOString(),
  });

  if (error) throw error;
  return (data ?? []) as SalesPoint[];
}

export async function fetchTopProducts(
  restaurantId: UUID,
  limit = 8,
  from?: Date,
): Promise<TopProduct[]> {
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const { data, error } = await getSupabase().rpc('fn_top_products', {
    p_restaurant_id: restaurantId,
    p_limit: limit,
    p_from: (from ?? defaultFrom).toISOString(),
  });

  if (error) throw error;
  return (data ?? []) as TopProduct[];
}

// ---------------------------------------------------------------------------
// Menu — produits
// ---------------------------------------------------------------------------

export async function fetchAllProducts(restaurantId: UUID): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as Product[];
}

export type ProductInput = Partial<Product> & {
  restaurant_id: UUID;
  name: string;
  base_price: number;
};

/** Slug stable : sert d'URL et de clé unique par restaurant. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    // Marques diacritiques combinantes : « Crème brûlée » → « creme-brulee ».
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function saveProduct(input: ProductInput & { id?: UUID }): Promise<Product> {
  const supabase = getSupabase();
  const payload = { ...input, slug: input.slug || slugify(input.name) };

  const { data, error } = input.id
    ? await supabase.from('products').update(payload).eq('id', input.id).select().single()
    : await supabase.from('products').insert(payload).select().single();

  if (error) throw error;
  return data as Product;
}

/**
 * Rupture de stock.
 *
 * Passe par une fonction SQL et non par un `update` direct : la RLS filtre des
 * lignes, pas des colonnes, et la policy d'écriture sur `products` est
 * réservée aux rôles OWNER/MANAGER. Or c'est la personne à la caisse — rôle
 * STAFF — qui constate qu'il n'y a plus de poulet. `fn_set_product_availability`
 * n'expose qu'une seule colonne : elle ne peut rien faire d'autre.
 */
export async function setProductAvailability(
  productId: UUID,
  isAvailable: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('fn_set_product_availability', {
    p_product_id: productId,
    p_is_available: isAvailable,
  });
  if (error) throw error;
}

export async function setProductActive(productId: UUID, isActive: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId);
  if (error) throw error;
}

/**
 * Suppression d'un produit.
 *
 * Les commandes passées conservent leur instantané (`order_items` est
 * dénormalisé), l'historique de facturation n'est donc jamais amputé.
 */
export async function deleteProduct(productId: UUID): Promise<void> {
  const { error } = await getSupabase().from('products').delete().eq('id', productId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Menu — catégories
// ---------------------------------------------------------------------------

export async function fetchAllCategories(restaurantId: UUID): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as Category[];
}

export type CategoryInput = Partial<Category> & { restaurant_id: UUID; name: string };

export async function saveCategory(input: CategoryInput & { id?: UUID }): Promise<Category> {
  const supabase = getSupabase();
  const payload = { ...input, slug: input.slug || slugify(input.name) };

  const { data, error } = input.id
    ? await supabase.from('categories').update(payload).eq('id', input.id).select().single()
    : await supabase.from('categories').insert(payload).select().single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(categoryId: UUID): Promise<void> {
  const { error } = await getSupabase().from('categories').delete().eq('id', categoryId);
  if (error) throw error;
}

/** Réordonnancement par glisser-déposer : une seule requête pour toute la liste. */
export async function reorderCategories(ordered: { id: UUID; sort_order: number }[]): Promise<void> {
  const supabase = getSupabase();
  const results = await Promise.all(
    ordered.map((row) =>
      supabase.from('categories').update({ sort_order: row.sort_order }).eq('id', row.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

// ---------------------------------------------------------------------------
// Menu — groupes d'options
// ---------------------------------------------------------------------------

export async function fetchProductOptionGroups(productId: UUID): Promise<ProductOptionGroup[]> {
  const { data, error } = await getSupabase()
    .from('product_option_groups')
    .select('*, options:product_options ( * )')
    .eq('product_id', productId)
    .order('sort_order');

  if (error) throw error;
  return ((data ?? []) as ProductOptionGroup[]).map((group) => ({
    ...group,
    options: [...(group.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function saveOptionGroup(
  input: Partial<ProductOptionGroup> & { product_id: UUID; name: string; id?: UUID },
): Promise<ProductOptionGroup> {
  const supabase = getSupabase();
  const { options: _options, ...payload } = input;

  const { data, error } = input.id
    ? await supabase
        .from('product_option_groups')
        .update(payload)
        .eq('id', input.id)
        .select()
        .single()
    : await supabase.from('product_option_groups').insert(payload).select().single();

  if (error) throw error;
  return { ...(data as ProductOptionGroup), options: [] };
}

export async function deleteOptionGroup(groupId: UUID): Promise<void> {
  const { error } = await getSupabase().from('product_option_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function saveOption(
  input: Partial<ProductOption> & { group_id: UUID; name: string; id?: UUID },
): Promise<ProductOption> {
  const supabase = getSupabase();
  const { data, error } = input.id
    ? await supabase.from('product_options').update(input).eq('id', input.id).select().single()
    : await supabase.from('product_options').insert(input).select().single();

  if (error) throw error;
  return data as ProductOption;
}

export async function deleteOption(optionId: UUID): Promise<void> {
  const { error } = await getSupabase().from('product_options').delete().eq('id', optionId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Livreurs
// ---------------------------------------------------------------------------

export async function fetchDrivers(restaurantId: UUID): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .select('*, profile:profiles ( full_name, phone, avatar_url )')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Driver[];
}

/** Livreurs éligibles à une assignation : approuvés et pas déjà en course. */
export async function fetchAssignableDrivers(restaurantId: UUID): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .select('*, profile:profiles ( full_name, phone, avatar_url )')
    .eq('restaurant_id', restaurantId)
    .eq('is_approved', true)
    .neq('availability', 'OFFLINE')
    .order('availability');

  if (error) throw error;
  return (data ?? []) as Driver[];
}

export async function approveDriver(driverId: UUID, isApproved: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('drivers')
    .update({ is_approved: isApproved })
    .eq('id', driverId);
  if (error) throw error;
}

/**
 * Retrouve un profil par e-mail ou téléphone.
 *
 * Sert à l'enrôlement d'un livreur : avant de créer un compte, on regarde si
 * la personne en a déjà un (elle a pu commander en tant que cliente). La
 * lecture passe par la policy `profiles_read_staff` — inutile de sortir la
 * clé service_role pour ça.
 *
 * La comparaison sur le téléphone ignore espaces, points et tirets : le même
 * numéro s'écrit « +243 89 000 00 01 » au clavier et « +243890000001 » en
 * base, et un enrôlement qui échoue sur un espace est incompréhensible.
 */
export async function findProfileByContact(
  contact: string,
): Promise<Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null> {
  const trimmed = contact.trim();
  if (!trimmed) return null;

  const isEmail = trimmed.includes('@');
  const normalized = isEmail ? trimmed.toLowerCase() : trimmed.replace(/[\s.-]/g, '');

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, email, phone')
    .or(`email.ilike.${normalized},phone.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null) ?? null;
}

export interface NewDriver {
  profileId: UUID;
  restaurantId: UUID;
  vehicle: VehicleType;
  plateNumber?: string | null;
  nationalId?: string | null;
  /** Un livreur enrôlé par le restaurant est approuvé d'office. */
  isApproved?: boolean;
}

/**
 * Rattache un profil existant à l'équipe de livraison.
 *
 * L'écriture est autorisée par la policy `drivers_manage_admin`
 * (`fn_can_manage_restaurant`) : pas de fonction SECURITY DEFINER à écrire,
 * pas de migration à passer en production pour cet écran.
 *
 * `profile_id` est unique : un `upsert` plutôt qu'un `insert` pour que
 * réenrôler un ancien livreur suspendu remette simplement sa fiche à jour au
 * lieu d'échouer sur une violation de contrainte.
 */
export async function createDriver(input: NewDriver): Promise<Driver> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .upsert(
      {
        profile_id: input.profileId,
        restaurant_id: input.restaurantId,
        vehicle: input.vehicle,
        plate_number: input.plateNumber?.trim() || null,
        national_id: input.nationalId?.trim() || null,
        is_approved: input.isApproved ?? true,
      },
      { onConflict: 'profile_id' },
    )
    .select('*, profile:profiles ( full_name, phone, avatar_url )')
    .single();

  if (error) throw error;
  return data as Driver;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface CustomerRow extends Pick<Profile, 'id' | 'full_name' | 'phone' | 'email' | 'created_at'> {
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
}

/**
 * Liste des clients avec leurs agrégats.
 *
 * Fait volontairement en deux requêtes plutôt qu'une jointure : à volume
 * modeste c'est plus rapide, et cela évite une vue SQL à maintenir. À revoir
 * au-delà de quelques milliers de clients (vue matérialisée).
 */
export async function fetchCustomers(restaurantId: UUID, limit = 200): Promise<CustomerRow[]> {
  const supabase = getSupabase();

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('customer_id, total, status, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;

  const aggregates = new Map<string, { count: number; spent: number; last: string }>();
  for (const row of (orders ?? []) as {
    customer_id: string;
    total: number;
    status: string;
    created_at: string;
  }[]) {
    const current = aggregates.get(row.customer_id) ?? { count: 0, spent: 0, last: row.created_at };
    current.count += 1;
    if (row.status === 'DELIVERED') current.spent += row.total;
    if (row.created_at > current.last) current.last = row.created_at;
    aggregates.set(row.customer_id, current);
  }

  const ids = [...aggregates.keys()].slice(0, limit);
  if (ids.length === 0) return [];

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email, created_at')
    .in('id', ids);

  if (error) throw error;

  return ((profiles ?? []) as CustomerRow[])
    .map((profile) => {
      const stats = aggregates.get(profile.id);
      return {
        ...profile,
        orders_count: stats?.count ?? 0,
        total_spent: stats?.spent ?? 0,
        last_order_at: stats?.last ?? null,
      };
    })
    .sort((a, b) => b.total_spent - a.total_spent);
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export async function fetchPromotions(restaurantId: UUID): Promise<Promotion[]> {
  const { data, error } = await getSupabase()
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Promotion[];
}

export async function savePromotion(
  input: Partial<Promotion> & { restaurant_id: UUID; title: string; type: Promotion['type']; id?: UUID },
): Promise<Promotion> {
  const supabase = getSupabase();
  const payload = { ...input, code: input.code ? input.code.trim().toUpperCase() : null };

  const { data, error } = input.id
    ? await supabase.from('promotions').update(payload).eq('id', input.id).select().single()
    : await supabase.from('promotions').insert(payload).select().single();

  if (error) throw error;
  return data as Promotion;
}

export async function deletePromotion(promotionId: UUID): Promise<void> {
  const { error } = await getSupabase().from('promotions').delete().eq('id', promotionId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Zones de livraison
// ---------------------------------------------------------------------------

export async function fetchAllDeliveryZones(restaurantId: UUID): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase()
    .from('delivery_zones')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('min_distance_km');

  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

export async function saveDeliveryZone(
  input: Partial<DeliveryZone> & { restaurant_id: UUID; name: string; id?: UUID },
): Promise<DeliveryZone> {
  const supabase = getSupabase();
  const { data, error } = input.id
    ? await supabase.from('delivery_zones').update(input).eq('id', input.id).select().single()
    : await supabase.from('delivery_zones').insert(input).select().single();

  if (error) throw error;
  return data as DeliveryZone;
}

export async function deleteDeliveryZone(zoneId: UUID): Promise<void> {
  const { error } = await getSupabase().from('delivery_zones').delete().eq('id', zoneId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Paramètres du restaurant
// ---------------------------------------------------------------------------

export async function updateRestaurant(
  restaurantId: UUID,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabase().from('restaurants').update(patch).eq('id', restaurantId);
  if (error) throw error;
}

/** Interrupteur « on prend les commandes / on n'en prend plus ». */
export async function setAcceptingOrders(restaurantId: UUID, accepting: boolean): Promise<void> {
  await updateRestaurant(restaurantId, { is_accepting_orders: accepting });
}
