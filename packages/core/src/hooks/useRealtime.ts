import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { UUID } from '@istanbul/types';
import { getSupabase } from '../supabase/client';
import { queryKeys } from '../query/keys';

/**
 * Abonnements temps réel.
 *
 * Principe : le canal ne transporte qu'un signal « quelque chose a changé ».
 * On invalide la requête React Query correspondante plutôt que d'appliquer
 * le payload à la main — la donnée reste ainsi cohérente avec ses relations
 * (items, historique, livreur), qu'aucun payload de réplication ne contient.
 */

function useChannel(factory: () => RealtimeChannel | null, deps: unknown[]): void {
  const ref = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = factory();
    ref.current = channel;

    return () => {
      if (ref.current) {
        void getSupabase().removeChannel(ref.current);
        ref.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Nom de canal unique par instance de hook.
 *
 * `supabase.channel(topic)` renvoie le canal EXISTANT si le topic est déjà
 * pris — et rattacher un callback après `subscribe()` lève une exception.
 * Deux écrans qui suivent la même commande (suivi + carte plein écran)
 * partageraient sinon le même topic et feraient tomber le second. Le nom du
 * canal est purement local : seul le filtre `postgres_changes` compte.
 */
let channelSeq = 0;
function uniqueChannel(base: string): string {
  channelSeq += 1;
  return `${base}:#${channelSeq}`;
}

/** Suivi d'une commande côté client : statut + timeline + livraison. */
export function useOrderRealtime(orderId: UUID | null): void {
  const queryClient = useQueryClient();

  useChannel(() => {
    if (!orderId) return null;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder() });
    };

    return getSupabase()
      .channel(uniqueChannel(`order:${orderId}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${orderId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `order_id=eq.${orderId}` },
        invalidate,
      )
      .subscribe();
  }, [orderId, queryClient]);
}

/**
 * File des commandes côté restaurant.
 *
 * `onNewOrder` sert à déclencher le son + la notification locale : une
 * nouvelle commande qui arrive pendant le coup de feu ne doit pas dépendre
 * du fait que quelqu'un regarde l'écran.
 */
export function useOrderQueueRealtime(
  restaurantId: UUID | null,
  onNewOrder?: (orderId: UUID) => void,
): void {
  const queryClient = useQueryClient();
  const callback = useRef(onNewOrder);
  callback.current = onNewOrder;

  useChannel(() => {
    if (!restaurantId) return null;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['order-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    return getSupabase()
      .channel(uniqueChannel(`orders:restaurant:${restaurantId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          invalidate();
          const id = (payload.new as { id?: UUID })?.id;
          if (id) callback.current?.(id);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        invalidate,
      )
      .subscribe();
  }, [restaurantId, queryClient]);
}

/** Courses du livreur : nouvelles offres et changements de statut. */
export function useDriverRealtime(driverId: UUID | null, onOffer?: () => void): void {
  const queryClient = useQueryClient();
  const callback = useRef(onOffer);
  callback.current = onOffer;

  useChannel(() => {
    if (!driverId) return null;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    };

    return getSupabase()
      .channel(uniqueChannel(`driver:${driverId}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deliveries' },
        () => {
          invalidate();
          callback.current?.();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`,
        },
        invalidate,
      )
      .subscribe();
  }, [driverId, queryClient]);
}

/**
 * Position du livreur sur la carte de suivi.
 *
 * Seul cas où on applique le payload directement : la latence compte, et une
 * position est une donnée autonome sans relation à recharger.
 */
export function useDriverLocationRealtime(deliveryId: UUID | null): void {
  const queryClient = useQueryClient();

  useChannel(() => {
    if (!deliveryId) return null;

    return getSupabase()
      .channel(uniqueChannel(`location:${deliveryId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          queryClient.setQueryData(queryKeys.driverLocation(deliveryId), payload.new);

          // La trace s'allonge d'un point : append en cache, sans refetch.
          const point = payload.new as { latitude: number; longitude: number; recorded_at: string };
          queryClient.setQueryData(
            queryKeys.driverTrail(deliveryId),
            (previous: unknown) =>
              Array.isArray(previous) ? [...previous, point] : previous,
          );
        },
      )
      .subscribe();
  }, [deliveryId, queryClient]);
}

/** Notifications in-app. */
export function useNotificationsRealtime(profileId: UUID | null): void {
  const queryClient = useQueryClient();

  useChannel(() => {
    if (!profileId) return null;

    return getSupabase()
      .channel(uniqueChannel(`notifications:${profileId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
        },
      )
      .subscribe();
  }, [profileId, queryClient]);
}
