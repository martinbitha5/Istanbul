import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '@istanbul/types';
import {
  addRestaurantMember,
  fetchOpeningHours,
  fetchRestaurantById,
  fetchRestaurantMembers,
  removeRestaurantMember,
  saveOpeningHours,
  saveRestaurant,
  setMemberRole,
  type RestaurantPatch,
} from '../api/restaurants';
import { queryKeys } from '../query/keys';

/**
 * Hooks d'administration de la fiche restaurant.
 *
 * Séparés de `useAdmin` volontairement : ces requêtes portent sur *l'identité
 * et l'équipe* de l'établissement, pas sur son exploitation quotidienne. Les
 * deux ont des durées de vie très différentes — une adresse change une fois
 * par an, la file des commandes toutes les secondes.
 */

// ---------------------------------------------------------------------------
// Fiche et horaires
// ---------------------------------------------------------------------------

export function useRestaurantDetail(restaurantId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.restaurant(restaurantId ?? ''),
    queryFn: () => fetchRestaurantById(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

function useInvalidateRestaurant() {
  const queryClient = useQueryClient();
  return (restaurantId: UUID) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.restaurant(restaurantId) });
    // La vitrine de l'app client lit les mêmes lignes.
    void queryClient.invalidateQueries({ queryKey: queryKeys.restaurants() });
  };
}

export function useSaveRestaurant() {
  const invalidate = useInvalidateRestaurant();
  return useMutation({
    mutationFn: ({ restaurantId, patch }: { restaurantId: UUID; patch: RestaurantPatch }) =>
      saveRestaurant(restaurantId, patch),
    onSuccess: (_data, { restaurantId }) => invalidate(restaurantId),
  });
}

export function useOpeningHours(restaurantId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.openingHours(restaurantId ?? ''),
    queryFn: () => fetchOpeningHours(restaurantId!),
    enabled: enabled && !!restaurantId,
    staleTime: 5 * 60_000,
  });
}

export function useSaveOpeningHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      week,
    }: {
      restaurantId: UUID;
      week: Parameters<typeof saveOpeningHours>[1];
    }) => saveOpeningHours(restaurantId, week),
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.openingHours(restaurantId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------

export function useRestaurantMembers(restaurantId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.restaurantMembers(restaurantId ?? ''),
    queryFn: () => fetchRestaurantMembers(restaurantId!),
    enabled: !!restaurantId,
  });
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return (restaurantId: UUID) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.restaurantMembers(restaurantId) });
  };
}

export function useAddRestaurantMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: addRestaurantMember,
    onSuccess: (_data, { restaurantId }) => invalidate(restaurantId),
  });
}

export function useSetMemberRole() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: setMemberRole,
    onSuccess: (_data, { restaurantId }) => invalidate(restaurantId),
  });
}

export function useRemoveRestaurantMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: removeRestaurantMember,
    onSuccess: (_data, { restaurantId }) => invalidate(restaurantId),
  });
}
