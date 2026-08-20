import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '@istanbul/types';
import {
  approveDriver,
  deleteCategory,
  deleteDeliveryZone,
  deleteOption,
  deleteOptionGroup,
  deleteProduct,
  deletePromotion,
  fetchAllCategories,
  fetchAllDeliveryZones,
  fetchAllProducts,
  fetchAssignableDrivers,
  fetchCustomers,
  fetchDashboardStats,
  fetchDrivers,
  fetchProductOptionGroups,
  fetchPromotions,
  fetchSalesSeries,
  fetchTopProducts,
  saveCategory,
  saveDeliveryZone,
  saveOption,
  saveOptionGroup,
  saveProduct,
  savePromotion,
  setAcceptingOrders,
  setProductActive,
  setProductAvailability,
  type SalesBucket,
} from '../api/admin';
import { queryKeys } from '../query/keys';

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

export function useDashboardStats(restaurantId: UUID, from?: Date, to?: Date) {
  return useQuery({
    queryKey: queryKeys.dashboardStats(restaurantId, from?.toISOString()),
    queryFn: () => fetchDashboardStats(restaurantId, from, to),
    refetchInterval: 60_000,
  });
}

export function useSalesSeries(restaurantId: UUID, bucket: SalesBucket = 'day') {
  return useQuery({
    queryKey: queryKeys.salesSeries(restaurantId, bucket),
    queryFn: () => fetchSalesSeries(restaurantId, bucket),
    staleTime: 5 * 60_000,
  });
}

export function useTopProducts(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.topProducts(restaurantId),
    queryFn: () => fetchTopProducts(restaurantId),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function useAdminProducts(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminProducts(restaurantId),
    queryFn: () => fetchAllProducts(restaurantId),
  });
}

export function useAdminCategories(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminCategories(restaurantId),
    queryFn: () => fetchAllCategories(restaurantId),
  });
}

export function useProductOptionGroups(productId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.adminOptionGroups(productId ?? ''),
    queryFn: () => fetchProductOptionGroups(productId!),
    enabled: !!productId,
  });
}

/**
 * Invalidation du catalogue.
 *
 * Une modification côté dashboard doit se voir dans l'app client : on purge
 * donc aussi les clés publiques, pas seulement les clés `admin`.
 */
function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return () => {
    // Ciblé sur le menu : invalider `['admin']` en entier refetchait aussi
    // livreurs, clients, promotions et zones à chaque bascule de disponibilité.
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'option-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['product'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  };
}

export function useSaveProduct() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: saveProduct, onSuccess: invalidate });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: deleteProduct, onSuccess: invalidate });
}

type ProductPatch = Record<string, unknown> & { id: UUID };

/**
 * Bascule optimiste d'un champ produit dans toutes les listes admin en cache.
 * Sur un réseau à 1-3 s de latence, un interrupteur qui attend l'aller-retour
 * serveur est un interrupteur sur lequel on double-clique.
 */
function useOptimisticProductToggle<TVariables extends { productId: UUID }>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  patch: (variables: TVariables) => Record<string, unknown>,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMenu();

  return useMutation({
    mutationFn,

    onMutate: async (variables: TVariables) => {
      const prefix = ['admin', 'products'] as const;
      await queryClient.cancelQueries({ queryKey: prefix });
      const previous = queryClient.getQueriesData({ queryKey: prefix });

      queryClient.setQueriesData({ queryKey: prefix }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return (old as ProductPatch[]).map((product) =>
          product.id === variables.productId ? { ...product, ...patch(variables) } : product,
        );
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },

    onSettled: invalidate,
  });
}

/** Rupture de stock — l'action la plus fréquente en plein service. */
export function useToggleProductAvailability() {
  return useOptimisticProductToggle(
    ({ productId, isAvailable }: { productId: UUID; isAvailable: boolean }) =>
      setProductAvailability(productId, isAvailable),
    ({ isAvailable }) => ({ is_available: isAvailable }),
  );
}

export function useToggleProductActive() {
  return useOptimisticProductToggle(
    ({ productId, isActive }: { productId: UUID; isActive: boolean }) =>
      setProductActive(productId, isActive),
    ({ isActive }) => ({ is_active: isActive }),
  );
}

export function useSaveCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: saveCategory, onSuccess: invalidate });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: deleteCategory, onSuccess: invalidate });
}

export function useSaveOptionGroup() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: saveOptionGroup, onSuccess: invalidate });
}

export function useDeleteOptionGroup() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: deleteOptionGroup, onSuccess: invalidate });
}

export function useSaveOption() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: saveOption, onSuccess: invalidate });
}

export function useDeleteOption() {
  const invalidate = useInvalidateMenu();
  return useMutation({ mutationFn: deleteOption, onSuccess: invalidate });
}

// ---------------------------------------------------------------------------
// Livreurs, clients, promotions, zones
// ---------------------------------------------------------------------------

export function useAdminDrivers(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminDrivers(restaurantId),
    queryFn: () => fetchDrivers(restaurantId),
    refetchInterval: 60_000,
  });
}

export function useAssignableDrivers(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.assignableDrivers(restaurantId),
    queryFn: () => fetchAssignableDrivers(restaurantId),
    refetchInterval: 30_000,
  });
}

export function useApproveDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ driverId, isApproved }: { driverId: UUID; isApproved: boolean }) =>
      approveDriver(driverId, isApproved),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
  });
}

export function useAdminCustomers(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminCustomers(restaurantId),
    queryFn: () => fetchCustomers(restaurantId),
    staleTime: 5 * 60_000,
  });
}

export function useAdminPromotions(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminPromotions(restaurantId),
    queryFn: () => fetchPromotions(restaurantId),
  });
}

export function useSavePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePromotion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      void queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      void queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

export function useAdminZones(restaurantId: UUID) {
  return useQuery({
    queryKey: queryKeys.adminZones(restaurantId),
    queryFn: () => fetchAllDeliveryZones(restaurantId),
  });
}

export function useSaveZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveDeliveryZone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zones'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery-quote'] });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDeliveryZone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zones'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
    },
  });
}

export function useSetAcceptingOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, accepting }: { restaurantId: UUID; accepting: boolean }) =>
      setAcceptingOrders(restaurantId, accepting),
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.restaurant(restaurantId) });
    },
  });
}
