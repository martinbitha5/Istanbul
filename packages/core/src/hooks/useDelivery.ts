import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryStatus, DriverAvailability, UUID } from '@istanbul/types';
import {
  advanceDeliveryStatus,
  claimDelivery,
  confirmDelivery,
  fetchActiveDeliveries,
  fetchAvailableDeliveries,
  fetchCompletedDeliveries,
  fetchDelivery,
  fetchDriverEarnings,
  fetchLatestDriverLocation,
  fetchMyDriverProfile,
  pushDriverLocation,
  setDriverAvailability,
} from '../api/delivery';
import { queryKeys } from '../query/keys';

export function useDriverProfile() {
  return useQuery({
    queryKey: queryKeys.driverProfile(),
    queryFn: fetchMyDriverProfile,
    staleTime: 60_000,
  });
}

export function useAvailableDeliveries(enabled = true) {
  return useQuery({
    queryKey: queryKeys.availableDeliveries(),
    queryFn: fetchAvailableDeliveries,
    enabled,
    // Une course non prise doit apparaître vite : c'est de l'argent qui attend.
    refetchInterval: 20_000,
  });
}

export function useActiveDeliveries(driverId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.activeDeliveries(driverId ?? ''),
    queryFn: () => fetchActiveDeliveries(driverId!),
    enabled: !!driverId,
    refetchInterval: 30_000,
  });
}

export function useCompletedDeliveries(driverId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.completedDeliveries(driverId ?? ''),
    queryFn: () => fetchCompletedDeliveries(driverId!),
    enabled: !!driverId,
  });
}

export function useDelivery(deliveryId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.delivery(deliveryId ?? ''),
    queryFn: () => fetchDelivery(deliveryId!),
    enabled: !!deliveryId,
  });
}

export function useDriverEarnings(driverId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.driverEarnings(driverId ?? ''),
    queryFn: () => fetchDriverEarnings(driverId!),
    enabled: !!driverId,
    staleTime: 60_000,
  });
}

/** Invalidation commune à toutes les mutations de course. */
function useInvalidateDeliveries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['delivery'] });
    void queryClient.invalidateQueries({ queryKey: ['driver-earnings'] });
    void queryClient.invalidateQueries({ queryKey: ['order-queue'] });
  };
}

export function useClaimDelivery() {
  const invalidate = useInvalidateDeliveries();

  return useMutation({
    mutationFn: ({ deliveryId, driverId }: { deliveryId: UUID; driverId: UUID }) =>
      claimDelivery(deliveryId, driverId),
    onSuccess: invalidate,
  });
}

export function useAdvanceDelivery() {
  const invalidate = useInvalidateDeliveries();

  return useMutation({
    mutationFn: ({ deliveryId, to }: { deliveryId: UUID; to: DeliveryStatus }) =>
      advanceDeliveryStatus(deliveryId, to),
    onSuccess: invalidate,
  });
}

/**
 * Clôture par code.
 *
 * `retry: false` est essentiel : chaque tentative incrémente le compteur
 * serveur, et cinq échecs bloquent la course. Un retry automatique
 * consommerait le quota du livreur sans qu'il comprenne pourquoi.
 */
export function useConfirmDelivery() {
  const invalidate = useInvalidateDeliveries();

  return useMutation({
    mutationFn: ({ deliveryId, code }: { deliveryId: UUID; code: string }) =>
      confirmDelivery(deliveryId, code),
    retry: false,
    onSuccess: invalidate,
  });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      driverId,
      availability,
    }: {
      driverId: UUID;
      availability: DriverAvailability;
    }) => setDriverAvailability(driverId, availability),

    onMutate: async ({ availability }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.driverProfile() });
      const previous = queryClient.getQueryData(queryKeys.driverProfile());
      queryClient.setQueryData(queryKeys.driverProfile(), (old: unknown) =>
        old ? { ...(old as object), availability } : old,
      );
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.driverProfile(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverProfile() });
    },
  });
}

/**
 * Remontée de position.
 *
 * Pas d'invalidation ni de gestion d'erreur bruyante : appelée toutes les
 * 15 s, un échec ponctuel est sans conséquence — la prochaine passera.
 */
export function usePushLocation() {
  return useMutation({
    mutationFn: pushDriverLocation,
    retry: false,
    onError: () => {
      /* silencieux par conception */
    },
  });
}

/** Position du livreur pour la carte de suivi côté client. */
export function useDriverLocation(deliveryId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.driverLocation(deliveryId ?? ''),
    queryFn: () => fetchLatestDriverLocation(deliveryId!),
    enabled: enabled && !!deliveryId,
    refetchInterval: 15_000,
  });
}
