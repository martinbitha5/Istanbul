import type {
  Category,
  DeliveryQuote,
  DeliveryZone,
  Product,
  ProductWithOptions,
  Promotion,
  Restaurant,
  UUID,
} from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Accès au catalogue.
 *
 * Ces requêtes sont lisibles sans être connecté : la vitrine doit s'afficher
 * avant l'écran de connexion (policy `products_read_all`).
 */

export async function fetchRestaurant(id: UUID): Promise<Restaurant> {
  const { data, error } = await getSupabase()
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Restaurant;
}

export async function fetchCategories(restaurantId: UUID): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('parent_id', null)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as Category[];
}

export interface ProductFilters {
  categoryId?: UUID | null;
  search?: string;
  popularOnly?: boolean;
  recommendedOnly?: boolean;
  limit?: number;
}

export async function fetchProducts(
  restaurantId: UUID,
  filters: ProductFilters = {},
): Promise<Product[]> {
  let query = getSupabase()
    .from('products')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.popularOnly) query = query.eq('is_popular', true);
  if (filters.recommendedOnly) query = query.eq('is_recommended', true);

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().replace(/[%,()]/g, '');
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  // Les produits en rupture restent visibles mais partent en fin de liste :
  // les masquer donne l'impression d'un menu qui rétrécit.
  query = query
    .order('is_available', { ascending: false })
    .order('sort_order')
    .limit(filters.limit ?? 100);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

/** Fiche produit complète, avec ses groupes d'options triés. */
export async function fetchProduct(productId: UUID): Promise<ProductWithOptions> {
  const { data, error } = await getSupabase()
    .from('products')
    .select(
      `*,
       category:categories ( id, name, slug ),
       option_groups:product_option_groups (
         *,
         options:product_options ( * )
       )`,
    )
    .eq('id', productId)
    .single();

  if (error) throw error;

  const product = data as unknown as ProductWithOptions;

  // PostgREST ne garantit pas l'ordre des relations imbriquées.
  product.option_groups = (product.option_groups ?? [])
    .map((group) => ({
      ...group,
      options: [...(group.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return product;
}

export async function fetchDeliveryZones(restaurantId: UUID): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase()
    .from('delivery_zones')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

/** Bannières promotionnelles de l'accueil (promotions sans code). */
export async function fetchPublicPromotions(restaurantId: UUID): Promise<Promotion[]> {
  // La fenêtre de validité se vérifie ici, pas seulement `is_active` :
  // une promo expirée mais jamais désactivée resterait affichée sur l'accueil.
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('code', null)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as Promotion[];
}

/** Devis de livraison pour une position donnée. */
export async function fetchDeliveryQuote(
  restaurantId: UUID,
  latitude: number | null,
  longitude: number | null,
  subtotal: number,
): Promise<DeliveryQuote> {
  const { data, error } = await getSupabase()
    .rpc('fn_delivery_quote', {
      p_restaurant_id: restaurantId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_subtotal: subtotal,
    })
    .single();

  if (error) throw error;
  return data as DeliveryQuote;
}

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

export async function fetchFavorites(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('favorites')
    .select('product:products ( * )')
    .order('created_at', { ascending: false });

  if (error) throw error;
  // PostgREST type les relations imbriquées en `any[]` : le passage par
  // `unknown` est nécessaire, TypeScript refusant un cast direct entre deux
  // formes qui ne se chevauchent pas.
  return ((data ?? []) as unknown as { product: Product | null }[])
    .map((row) => row.product)
    .filter((product): product is Product => product !== null);
}

export async function fetchFavoriteIds(): Promise<UUID[]> {
  const { data, error } = await getSupabase().from('favorites').select('product_id');
  if (error) throw error;
  return ((data ?? []) as { product_id: UUID }[]).map((row) => row.product_id);
}

export async function toggleFavorite(productId: UUID, isFavorite: boolean): Promise<void> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getUser();
  const profileId = session.user?.id;
  if (!profileId) throw new Error('Connectez-vous pour enregistrer vos favoris.');

  if (isFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('product_id', productId)
      .eq('profile_id', profileId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ product_id: productId, profile_id: profileId });
    if (error) throw error;
  }
}
