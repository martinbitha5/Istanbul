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
  fetchDriverTrail,
  fetchLatestDriverLocation,
  fetchMyDriverProfile,
  pushDriverLocation,
  setDriverAvailability,
} from '../api/delivery';
import { queryKeys } from '../query/keys';
import { useSession } from './useSession';

/**
 * Fiche livreur de l'utilisateur connecté.
 *
 * `enabled` n'est pas une optimisation : sans lui, la requête partait au
 * montage de l'app livreur, avant que Supabase ait fini de relire la session
 * dans le stockage. `fetchMyDriverProfile` ne trouvait alors aucun utilisateur
 * et renvoyait `null` — un *succès*, mis en cache pour 60 s. La session
 * arrivait une fraction de seconde plus tard, le portier voyait
 * `session` non nul et `driver` nul, et affichait « Compte non reconnu » à un
 * livreur parfaitement enregistré.
 *
 * L'invalidation sur `SIGNED_IN` (voir useSession) ferme l'autre moitié du
 * piège : celle où la connexion arrive après que le `null` a été mis en cache.
 */
export function useDriverProfile() {
  const { session } = useSession();

  return useQuery({
    queryKey: queryKeys.driverProfile(),
    queryFn: fetchMyDriverProfile,
    enabled: !!session,
    staleTime: 60_000,
  });
}

export function useAvailableDeliveries(driverId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.availableDeliveries(driverId),
    queryFn: () => fetchAvailableDeliveries(driverId),
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

/**
 * Accepter une course du pool.
 *
 * `retry: false` : le serveur arbitre déjà les acceptations simultanées et
 * répond « prise par un autre livreur ». Réessayer ne peut que transformer ce
 * refus définitif en attente inutile devant un livreur qui a besoin de
 * regarder la course suivante tout de suite.
 */
export function useClaimDelivery() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDeliveries();

  return useMutation({
    mutationFn: ({ deliveryId }: { deliveryId: UUID }) => claimDelivery(deliveryId),
    retry: false,
    onSuccess: () => {
      // Le livreur passe BUSY côté serveur : sans cette invalidation, sa
      // fiche en cache le croit encore AVAILABLE et l'écran d'accueil lui
      // propose des courses qu'il ne peut plus prendre.
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverProfile() });
      invalidate();
    },
  });
}

export function useAdvanceDelivery() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDeliveries();

  return useMutation({
    mutationFn: ({ deliveryId, to }: { deliveryId: UUID; to: DeliveryStatus }) =>
      advanceDeliveryStatus(deliveryId, to),

    // Optimiste : le livreur est à moto sur un réseau à 1-3 s de latence.
    // Le statut bascule immédiatement à l'écran, et revient en cas de refus
    // serveur (la machine à états SQL reste l'autorité).
    onMutate: async ({ deliveryId, to }) => {
      const key = queryKeys.delivery(deliveryId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: unknown) =>
        old ? { ...(old as object), status: to } : old,
      );
      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: invalidate,
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
    // `silent` : exclut aussi cette mutation du filet d'erreur global.
    meta: { silent: true },
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

/** Trace GPS complète de la course — l'itinéraire réellement parcouru. */
export function useDriverTrail(deliveryId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.driverTrail(deliveryId ?? ''),
    queryFn: () => fetchDriverTrail(deliveryId!),
    enabled: enabled && !!deliveryId,
    // Le realtime pousse déjà chaque nouveau point ; ce refetch n'est qu'un
    // filet si le canal tombe.
    refetchInterval: 30_000,
  });
}
