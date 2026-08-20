import type { LoyaltyTransaction } from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Programme de fidélité.
 *
 * Le solde vit sur `profiles.loyalty_points` (déjà chargé avec le profil) ;
 * ici, seulement l'historique. Les écritures passent exclusivement par le
 * serveur : gain à la livraison, dépense dans fn_place_order.
 */

export async function fetchLoyaltyTransactions(limit = 50): Promise<LoyaltyTransaction[]> {
  const { data, error } = await getSupabase()
    .from('loyalty_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LoyaltyTransaction[];
}

/** Valeur d'un point en centimes — doit refléter app_config côté serveur. */
export const LOYALTY_POINT_VALUE_CENTS = 5;

/** Réduction (centimes) obtenue en brûlant `points`, plafonnée au montant dû. */
export function loyaltyDiscount(points: number, due: number): number {
  return Math.min(Math.max(0, points) * LOYALTY_POINT_VALUE_CENTS, Math.max(0, due));
}

/** Points nécessaires pour couvrir `amount` centimes (arrondi supérieur). */
export function pointsForAmount(amount: number): number {
  return Math.ceil(Math.max(0, amount) / LOYALTY_POINT_VALUE_CENTS);
}
