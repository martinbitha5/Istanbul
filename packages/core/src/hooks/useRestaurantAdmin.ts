import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '@istanbul/types';
import {
  addRestaurantMember,
  createRestaurant,
  fetchAllBilling,
  fetchAllRestaurants,
  fetchMyRestaurants,
  fetchOpeningHours,
  fetchPlatformRevenue,
  fetchRestaurantBilling,
  fetchRestaurantById,
  fetchRestaurantMembers,
  removeRestaurantMember,
  saveOpeningHours,
  saveRestaurant,
  saveRestaurantBilling,
  setMemberRole,
  type RestaurantPatch,
} from '../api/restaurants';
import { queryKeys } from '../query/keys';

/**
 * Hooks du périmètre multi-établissements.
 *
 * Séparés de `useAdmin` volontairement : ces requêtes portent sur *quel*
 * restaurant on administre, pas sur *ce qu'on y fait*. Les deux ont des
 * durées de vie très différentes — la liste des établissements change une
 * fois par trimestre, la file des commandes toutes les secondes.
 */

// ---------------------------------------------------------------------------
// Périmètre
// ---------------------------------------------------------------------------

export function useMyRestaurants() {
  return useQuery({
    queryKey: queryKeys.myRestaurants(),
    queryFn: fetchMyRestaurants,
    // Le sélecteur d'établissement ne doit jamais clignoter au changement de
    // page : on garde la liste fraîche longtemps.
    staleTime: 10 * 60_000,
  });
}

export function useRestaurantDetail(restaurantId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.restaurant(restaurantId ?? ''),
    queryFn: () => fetchRestaurantById(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Fiche et horaires
// ---------------------------------------------------------------------------

function useInvalidateRestaurant() {
  const queryClient = useQueryClient();
  return (restaurantId: UUID) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.restaurant(restaurantId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.myRestaurants() });
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

// ---------------------------------------------------------------------------
// Conditions commerciales
// ---------------------------------------------------------------------------

export function useRestaurantBilling(restaurantId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.restaurantBilling(restaurantId ?? ''),
    queryFn: () => fetchRestaurantBilling(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  });
}

export function useSaveRestaurantBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      patch,
    }: {
      restaurantId: UUID;
      patch: Parameters<typeof saveRestaurantBilling>[1];
    }) => saveRestaurantBilling(restaurantId, patch),
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.restaurantBilling(restaurantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allBilling() });
    },
  });
}

/** Toutes les commissions, indexées par restaurant — écran « Partenaires ». */
export function useAllBilling(enabled = true) {
  return useQuery({
    queryKey: queryKeys.allBilling(),
    queryFn: fetchAllBilling,
    enabled,
    staleTime: 5 * 60_000,
    select: (rows) => new Map(rows.map((row) => [row.restaurant_id, row])),
  });
}

export function useOpeningHours(restaurantId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.openingHours(restaurantId ?? ''),
    queryFn: () => fetchOpeningHours(restaurantId!),
    enabled: !!restaurantId,
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

// ---------------------------------------------------------------------------
// Plateforme
// ---------------------------------------------------------------------------

export function useAllRestaurants(enabled = true) {
  return useQuery({
    queryKey: queryKeys.allRestaurants(),
    queryFn: fetchAllRestaurants,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Période d'analyse des revenus.
 *
 * Bornée à des périodes closes ou en cours, jamais à une plage libre : une
 * facturation se raisonne en mois, pas en « du 3 au 17 ».
 */
export type RevenuePeriod = 'month' | 'previous-month' | 'quarter' | 'year';

export function revenueRange(period: RevenuePeriod, now = new Date()): { from: Date; to: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'previous-month':
      // Le mois clos : c'est celui qu'on facture.
      return { from: new Date(year, month - 1, 1), to: new Date(year, month, 0, 23, 59, 59) };
    case 'quarter':
      return { from: new Date(year, Math.floor(month / 3) * 3, 1), to: now };
    case 'year':
      return { from: new Date(year, 0, 1), to: now };
    case 'month':
    default:
      return { from: new Date(year, month, 1), to: now };
  }
}

export function usePlatformRevenue(period: RevenuePeriod, enabled = true) {
  const { from, to } = revenueRange(period);

  return useQuery({
    queryKey: queryKeys.platformRevenue(period),
    queryFn: () => fetchPlatformRevenue(from, to),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateRestaurant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRestaurant,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allRestaurants() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRestaurants() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.restaurants() });
    },
  });
}
