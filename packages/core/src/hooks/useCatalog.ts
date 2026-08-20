import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '@istanbul/types';
import {
  fetchCategories,
  fetchDeliveryQuote,
  fetchDeliveryZones,
  fetchFavoriteIds,
  fetchFavorites,
  fetchProduct,
  fetchProducts,
  fetchPublicPromotions,
  fetchRestaurant,
  toggleFavorite,
  type ProductFilters,
} from '../api/catalog';
import { queryKeys } from '../query/keys';

export function useRestaurant(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.restaurant(restaurantId),
    queryFn: () => fetchRestaurant(restaurantId),
    // Le menu change rarement en cours de service.
    staleTime: 10 * 60_000,
  });
}

export function useCategories(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.categories(restaurantId),
    queryFn: () => fetchCategories(restaurantId),
    staleTime: 10 * 60_000,
  });
}

export function useProducts(restaurantId: UUID, filters: ProductFilters = {}) {
  return useQuery({
    queryKey: queryKeys.products(restaurantId, filters),
    queryFn: () => fetchProducts(restaurantId, filters),
    staleTime: 5 * 60_000,
    // Garde l'ancienne liste affichée pendant qu'on change de catégorie :
    // évite le flash de skeleton à chaque tap sur une puce.
    placeholderData: (previous) => previous,
  });
}

export function useProduct(productId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.product(productId ?? ''),
    queryFn: () => fetchProduct(productId!),
    enabled: !!productId,
    staleTime: 5 * 60_000,
  });
}

export function usePromotions(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.promotions(restaurantId),
    queryFn: () => fetchPublicPromotions(restaurantId),
    staleTime: 10 * 60_000,
  });
}

export function useDeliveryZones(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.deliveryZones(restaurantId),
    queryFn: () => fetchDeliveryZones(restaurantId),
    staleTime: 30 * 60_000,
  });
}

export function useDeliveryQuote(
  restaurantId: UUID,
  latitude: number | null,
  longitude: number | null,
  subtotal: number,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.deliveryQuote(restaurantId, latitude, longitude, subtotal),
    queryFn: () => fetchDeliveryQuote(restaurantId, latitude, longitude, subtotal),
    enabled: enabled && !!restaurantId,
    staleTime: 60_000,
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: queryKeys.favorites(),
    queryFn: fetchFavorites,
  });
}

export function useFavoriteIds() {
  const query = useQuery({
    queryKey: queryKeys.favoriteIds(),
    queryFn: fetchFavoriteIds,
  });

  // Référence stable : un `new Set()` à chaque rendu casserait toute
  // mémoïsation en aval (chaque `ProductCard` se re-rendrait en permanence).
  const ids = useMemo(() => new Set(query.data ?? []), [query.data]);

  return {
    ...query,
    ids,
  };
}

/**
 * Bascule d'un favori avec mise à jour optimiste : le cœur doit se remplir
 * instantanément, pas après un aller-retour réseau de 800 ms.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, isFavorite }: { productId: UUID; isFavorite: boolean }) =>
      toggleFavorite(productId, isFavorite),

    onMutate: async ({ productId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favoriteIds() });
      const previous = queryClient.getQueryData<UUID[]>(queryKeys.favoriteIds()) ?? [];

      queryClient.setQueryData<UUID[]>(
        queryKeys.favoriteIds(),
        isFavorite ? previous.filter((id) => id !== productId) : [...previous, productId],
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.favoriteIds(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favoriteIds() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites() });
    },
  });
}
