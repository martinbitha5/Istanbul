import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '@istanbul/types';
import { fetchOrderReview, submitReview, type SubmitReviewInput } from '../api/reviews';
import { fetchLoyaltyTransactions } from '../api/loyalty';
import { queryKeys } from '../query/keys';

/** La note existante d'une commande (null tant que le client n'a pas noté). */
export function useOrderReview(orderId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orderReview(orderId ?? ''),
    queryFn: () => fetchOrderReview(orderId!),
    enabled: enabled && !!orderId,
    staleTime: Infinity, // une note ne change jamais
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitReviewInput) => submitReview(input),
    onSuccess: (review) => {
      queryClient.setQueryData(queryKeys.orderReview(review.order_id), review);
    },
  });
}

/** Historique des points fidélité. Le solde vit sur le profil. */
export function useLoyaltyTransactions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.loyaltyTransactions(),
    queryFn: () => fetchLoyaltyTransactions(),
    enabled,
    staleTime: 60_000,
  });
}
