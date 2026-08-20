/**
 * Énumérations du domaine.
 *
 * Ces valeurs sont le miroir exact des types PostgreSQL de la migration 01.
 * Toute divergence est un bug : le test `enums.test.ts` compare les deux.
 */

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  DRIVER: 'DRIVER',
  RESTAURANT_STAFF: 'RESTAURANT_STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Rôle dans l'équipe d'Istanbul.
 *
 * `UserRole` dit ce qu'une personne est vis-à-vis de l'application (client,
 * livreur, staff) ; `RestaurantRole` dit jusqu'où elle va dans le dashboard.
 * Les deux sont nécessaires : le caissier et le propriétaire ont tous deux le
 * rôle applicatif RESTAURANT_STAFF, mais l'un ne doit pas toucher aux prix.
 */
export const RestaurantRole = {
  /** Tout, y compris l'équipe et les paramètres de l'établissement. */
  OWNER: 'OWNER',
  /** Exploitation complète (menu, promos, zones, livreurs) sans l'équipe. */
  MANAGER: 'MANAGER',
  /** Service au quotidien : commandes et disponibilité des produits. */
  STAFF: 'STAFF',
} as const;
export type RestaurantRole = (typeof RestaurantRole)[keyof typeof RestaurantRole];

export const FulfillmentType = {
  DELIVERY: 'DELIVERY',
  PICKUP: 'PICKUP',
} as const;
export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

export const OrderStatus = {
  NEW: 'NEW',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const DeliveryStatus = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  HEADING_TO_RESTAURANT: 'HEADING_TO_RESTAURANT',
  PICKED_UP: 'PICKED_UP',
  HEADING_TO_CUSTOMER: 'HEADING_TO_CUSTOMER',
  ARRIVED: 'ARRIVED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DriverAvailability = {
  OFFLINE: 'OFFLINE',
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
} as const;
export type DriverAvailability = (typeof DriverAvailability)[keyof typeof DriverAvailability];

export const VehicleType = {
  MOTORCYCLE: 'MOTORCYCLE',
  BICYCLE: 'BICYCLE',
  CAR: 'CAR',
  ON_FOOT: 'ON_FOOT',
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const PaymentProvider = {
  CASH: 'CASH',
  MPESA: 'MPESA',
  ORANGE_MONEY: 'ORANGE_MONEY',
  AIRTEL_MONEY: 'AIRTEL_MONEY',
  CARD: 'CARD',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const OptionSelectionType = {
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
} as const;
export type OptionSelectionType = (typeof OptionSelectionType)[keyof typeof OptionSelectionType];

export const PromotionType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  FREE_DELIVERY: 'FREE_DELIVERY',
} as const;
export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const NotificationTopic = {
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_ACCEPTED: 'ORDER_ACCEPTED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  DRIVER_ON_THE_WAY: 'DRIVER_ON_THE_WAY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  DELIVERY_OFFERED: 'DELIVERY_OFFERED',
  PROMOTION: 'PROMOTION',
} as const;
export type NotificationTopic = (typeof NotificationTopic)[keyof typeof NotificationTopic];
