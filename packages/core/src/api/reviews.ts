import type { Review, UUID } from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Notation d'une commande livrée.
 *
 * Les garde-fous vivent côté serveur (trg_reviews_guard) : commande livrée,
 * appartenant au client, une seule note. L'app se contente d'afficher.
 */

export async function fetchOrderReview(orderId: UUID): Promise<Review | null> {
  const { data, error } = await getSupabase()
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return (data as Review | null) ?? null;
}

export interface SubmitReviewInput {
  orderId: UUID;
  foodRating?: number | null;
  driverRating?: number | null;
  comment?: string | null;
}

export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  const { data: session } = await getSupabase().auth.getUser();
  const profileId = session.user?.id;
  if (!profileId) throw new Error('Authentification requise.');

  const { data, error } = await getSupabase()
    .from('reviews')
    .insert({
      order_id: input.orderId,
      profile_id: profileId,
      food_rating: input.foodRating ?? null,
      driver_rating: input.driverRating ?? null,
      comment: input.comment?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Review;
}
