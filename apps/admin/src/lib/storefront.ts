import { cache } from 'react';
import type { Category, DeliveryZone, Product, Promotion, Restaurant } from '@istanbul/types';
import { createClient } from '@/lib/supabase/server';

/**
 * Chargement de la vitrine, côté serveur.
 *
 * Tout ce qui est lu ici est public : les policies `restaurants_read_all`,
 * `categories_read_all`, `products_read_all`, `delivery_zones_read_all` et
 * `promotions_read_public` sont accordées au rôle `anon`. Un visiteur non
 * connecté voit donc la vitrine complète au premier rendu, sans écran
 * d'attente ni aller-retour d'authentification.
 *
 * Pourquoi côté serveur plutôt qu'avec les hooks React Query de
 * `@istanbul/core` : l'accueil et le feed sont les deux pages que Google
 * indexe et que le client ouvre en premier. Un squelette hydraté ensuite
 * coûterait le pire des deux mondes — pas de contenu pour le robot, et un
 * flash de chargement pour l'humain.
 */

/** L'établissement, ses catégories, ses produits et ses promos, en un appel. */
export interface Storefront {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
  zones: DeliveryZone[];
}

/**
 * `null` quand la base est vierge (migrations passées, seed non chargé).
 * Les pages affichent alors un message explicite plutôt que de planter sur un
 * identifiant vide.
 */
export const getStorefront = cache(async (): Promise<Storefront | null> => {
  const supabase = await createClient();

  // Mono-restaurant : la table ne contient qu'une ligne, garantie par le
  // trigger `trg_restaurants_single`. `maybeSingle` plutôt que `single` —
  // une base vide ne doit pas remonter une erreur PostgREST.
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!restaurant) return null;

  const id = (restaurant as Restaurant).id;
  const nowIso = new Date().toISOString();

  // Les quatre requêtes sont indépendantes : les enchaîner ajouterait trois
  // fois la latence réseau pour rien.
  const [categories, products, promotions, zones] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .is('parent_id', null)
      .order('sort_order'),
    supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      // Les ruptures restent visibles mais en fin de liste : les masquer
      // donne l'impression d'une carte qui rétrécit.
      .order('is_available', { ascending: false })
      .order('sort_order')
      .limit(120),
    supabase
      .from('promotions')
      .select('*')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .is('code', null)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('sort_order'),
    supabase
      .from('delivery_zones')
      .select('*')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  return {
    restaurant: restaurant as Restaurant,
    categories: (categories.data ?? []) as Category[],
    products: (products.data ?? []) as Product[],
    promotions: (promotions.data ?? []) as Promotion[],
    zones: (zones.data ?? []) as DeliveryZone[],
  };
});

/**
 * Note moyenne d'un produit, ou `null` s'il n'a jamais été noté.
 *
 * Uber Eats affiche une note sur chaque carte. Ici elle vient des vraies
 * colonnes `rating_sum` / `rating_count` : pas de 4,5 inventé pour faire joli
 * — une carte sans avis n'affiche simplement pas de note.
 */
export function productRating(product: Pick<Product, 'rating_sum' | 'rating_count'>) {
  if (product.rating_count === 0) return null;
  return product.rating_sum / product.rating_count;
}
