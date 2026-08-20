import type { UUID } from '@istanbul/types';
import type { ProductFilters } from '../api/catalog';
import type { OrderQueueFilters } from '../api/orders';
import type { SalesBucket } from '../api/admin';

/**
 * Clés React Query centralisées.
 *
 * Une clé écrite à la main dans un composant est une invalidation ratée qui
 * attend son heure. Tout passe par ici.
 */
export const queryKeys = {
  restaurant: (id: UUID) => ['restaurant', id] as const,
  restaurants: () => ['restaurants'] as const,

  restaurantMembers: (restaurantId: UUID) => ['admin', 'members', restaurantId] as const,
  openingHours: (restaurantId: UUID) => ['opening-hours', restaurantId] as const,

  categories: (restaurantId: UUID) => ['categories', restaurantId] as const,

  products: (restaurantId: UUID, filters: ProductFilters = {}) =>
    ['products', restaurantId, filters] as const,
  product: (id: UUID) => ['product', id] as const,

  promotions: (restaurantId: UUID) => ['promotions', restaurantId] as const,
  deliveryZones: (restaurantId: UUID) => ['delivery-zones', restaurantId] as const,
  deliveryQuote: (restaurantId: UUID, lat: number | null, lng: number | null, subtotal: number) =>
    ['delivery-quote', restaurantId, lat, lng, subtotal] as const,

  profile: () => ['profile'] as const,
  addresses: () => ['addresses'] as const,
  favorites: () => ['favorites'] as const,
  favoriteIds: () => ['favorite-ids'] as const,

  myOrders: () => ['orders', 'mine'] as const,
  activeOrder: () => ['orders', 'active'] as const,
  order: (id: UUID) => ['order', id] as const,
  confirmationCode: (orderId: UUID) => ['confirmation-code', orderId] as const,

  orderQueue: (filters: OrderQueueFilters) => ['order-queue', filters] as const,

  driverProfile: () => ['driver', 'me'] as const,
  availableDeliveries: () => ['deliveries', 'available'] as const,
  activeDeliveries: (driverId: UUID) => ['deliveries', 'active', driverId] as const,
  completedDeliveries: (driverId: UUID) => ['deliveries', 'completed', driverId] as const,
  delivery: (id: UUID) => ['delivery', id] as const,
  driverEarnings: (driverId: UUID) => ['driver-earnings', driverId] as const,
  driverLocation: (deliveryId: UUID) => ['driver-location', deliveryId] as const,
  driverTrail: (deliveryId: UUID) => ['driver-trail', deliveryId] as const,

  dashboardStats: (restaurantId: UUID, from?: string) =>
    ['dashboard-stats', restaurantId, from ?? 'today'] as const,
  salesSeries: (restaurantId: UUID, bucket: SalesBucket) =>
    ['sales-series', restaurantId, bucket] as const,
  topProducts: (restaurantId: UUID) => ['top-products', restaurantId] as const,

  adminProducts: (restaurantId: UUID) => ['admin', 'products', restaurantId] as const,
  adminCategories: (restaurantId: UUID) => ['admin', 'categories', restaurantId] as const,
  adminOptionGroups: (productId: UUID) => ['admin', 'option-groups', productId] as const,
  adminDrivers: (restaurantId: UUID) => ['admin', 'drivers', restaurantId] as const,
  assignableDrivers: (restaurantId: UUID) => ['admin', 'assignable-drivers', restaurantId] as const,
  adminCustomers: (restaurantId: UUID) => ['admin', 'customers', restaurantId] as const,
  adminPromotions: (restaurantId: UUID) => ['admin', 'promotions', restaurantId] as const,
  adminZones: (restaurantId: UUID) => ['admin', 'zones', restaurantId] as const,

  notifications: () => ['notifications'] as const,

  orderReview: (orderId: UUID) => ['order-review', orderId] as const,
  loyaltyTransactions: () => ['loyalty-transactions'] as const,
} as const;
