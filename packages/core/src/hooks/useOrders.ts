import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderStatus, UUID } from '@istanbul/types';
import {
  advanceOrderStatus,
  assignDriver,
  cancelOrder,
  deleteAddress,
  evaluatePromotion,
  fetchActiveOrder,
  fetchAddresses,
  fetchConfirmationCode,
  fetchMyOrders,
  fetchOrder,
  fetchOrderQueue,
  placeOrder,
  saveAddress,
  type AddressInput,
  type OrderQueueFilters,
  type PlaceOrderInput,
} from '../api/orders';
import { queryKeys } from '../query/keys';
import { useCartStore } from '../store/cart';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function useMyOrders() {
  return useQuery({
    queryKey: queryKeys.myOrders(),
    queryFn: () => fetchMyOrders(),
  });
}

export function useOrder(orderId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ''),
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId,
    // Filet de sécurité si le canal Realtime tombe : on ne veut jamais qu'un
    // client reste bloqué sur « En préparation » alors que sa commande arrive.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && status !== 'DELIVERED' && status !== 'CANCELLED' ? 30_000 : false;
    },
  });
}

/**
 * Code de confirmation, réservé au client de la commande.
 * Inutile de le charger une fois la commande livrée.
 */
export function useConfirmationCode(orderId: UUID | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.confirmationCode(orderId ?? ''),
    queryFn: () => fetchConfirmationCode(orderId!),
    enabled: enabled && !!orderId,
    staleTime: Infinity,
  });
}

export function useActiveOrder() {
  return useQuery({
    queryKey: queryKeys.activeOrder(),
    queryFn: fetchActiveOrder,
    refetchInterval: 60_000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const clearCart = useCartStore((state) => state.clear);

  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrder(input),
    // L'échec est affiché inline par le checkout (InlineAlert près du CTA) :
    // exclu du toast global pour éviter le double message.
    meta: { silent: true },
    onSuccess: (order) => {
      clearCart();
      // Surtout ne PAS semer queryKeys.order(id) avec ce résultat : c'est la
      // ligne `orders` brute, sans items/delivery/payment. L'écran de suivi
      // la prendrait pour une commande complète (items undefined → crash).
      // Il fait son propre fetch hydraté ; on préchauffe seulement les listes.
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder() });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: UUID; reason: string }) =>
      cancelOrder(orderId, reason),
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder() });
    },
  });
}

/** Validation d'un code promo au checkout. */
export function useEvaluatePromotion() {
  return useMutation({
    // Un code invalide est un cas nominal géré inline par le champ promo.
    meta: { silent: true },
    mutationFn: ({
      restaurantId,
      code,
      subtotal,
      deliveryFee,
    }: {
      restaurantId: UUID;
      code: string;
      subtotal: number;
      deliveryFee: number;
    }) => evaluatePromotion(restaurantId, code, subtotal, deliveryFee),
  });
}

// ---------------------------------------------------------------------------
// Adresses
// ---------------------------------------------------------------------------

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.addresses(),
    queryFn: fetchAddresses,
  });
}

export function useSaveAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddressInput) => saveAddress(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses() });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressId: UUID) => deleteAddress(addressId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses() });
    },
  });
}

// ---------------------------------------------------------------------------
// Restaurant / admin
// ---------------------------------------------------------------------------

export function useOrderQueue(filters: OrderQueueFilters) {
  return useQuery({
    queryKey: queryKeys.orderQueue(filters),
    queryFn: () => fetchOrderQueue(filters),
    // Realtime pousse déjà les changements ; ce refetch couvre les reconnexions.
    refetchInterval: 45_000,
    placeholderData: (previous) => previous,
  });
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      to,
      note,
    }: {
      orderId: UUID;
      to: OrderStatus;
      note?: string;
    }) => advanceOrderStatus(orderId, to, note),

    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), (previous: unknown) =>
        previous ? { ...(previous as object), ...order } : previous,
      );
      void queryClient.invalidateQueries({ queryKey: ['order-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useAssignDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      driverId,
      payoutAmount,
    }: {
      orderId: UUID;
      driverId: UUID;
      payoutAmount?: number;
    }) => assignDriver(orderId, driverId, payoutAmount),

    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: ['order-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assignable-drivers'] });
    },
  });
}
