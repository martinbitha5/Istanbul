import { DeliveryStatus, FulfillmentType, OrderStatus } from './enums';

/**
 * Machine à états — miroir TypeScript des fonctions SQL
 * `fn_order_can_transition` et `fn_delivery_can_transition`.
 *
 * Le serveur reste l'autorité : cette copie sert à griser un bouton avant
 * l'appel réseau, pas à autoriser quoi que ce soit.
 */

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  // READY dépend du mode : voir canTransitionOrder.
  READY: ['ASSIGNED', 'DELIVERED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: FulfillmentType,
): boolean {
  if (from === to) return true;
  if (from === 'READY') {
    return fulfillment === 'PICKUP'
      ? to === 'DELIVERED' || to === 'CANCELLED'
      : to === 'ASSIGNED' || to === 'CANCELLED';
  }
  return ORDER_TRANSITIONS[from].includes(to);
}

export function nextOrderStatus(
  from: OrderStatus,
  fulfillment: FulfillmentType,
): OrderStatus | null {
  switch (from) {
    case 'NEW':
      return 'ACCEPTED';
    case 'ACCEPTED':
      return 'PREPARING';
    case 'PREPARING':
      return 'READY';
    case 'READY':
      return fulfillment === 'PICKUP' ? 'DELIVERED' : 'ASSIGNED';
    case 'ASSIGNED':
      return 'PICKED_UP';
    case 'PICKED_UP':
      return 'DELIVERED';
    default:
      return null;
  }
}

export function isOrderTerminal(status: OrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}

export function canCancelOrder(status: OrderStatus): boolean {
  return !isOrderTerminal(status);
}

/** Le client ne peut annuler que tant que rien n'est parti en cuisine. */
export function customerCanCancel(status: OrderStatus): boolean {
  return status === 'NEW' || status === 'ACCEPTED';
}

const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  OFFERED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['HEADING_TO_RESTAURANT', 'CANCELLED'],
  REJECTED: [],
  HEADING_TO_RESTAURANT: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['HEADING_TO_CUSTOMER', 'CANCELLED'],
  HEADING_TO_CUSTOMER: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return true;
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function nextDeliveryStatus(from: DeliveryStatus): DeliveryStatus | null {
  switch (from) {
    case 'OFFERED':
      return 'ACCEPTED';
    case 'ACCEPTED':
      return 'HEADING_TO_RESTAURANT';
    case 'HEADING_TO_RESTAURANT':
      return 'PICKED_UP';
    case 'PICKED_UP':
      return 'HEADING_TO_CUSTOMER';
    case 'HEADING_TO_CUSTOMER':
      return 'ARRIVED';
    case 'ARRIVED':
      return 'DELIVERED'; // exige le code de confirmation
    default:
      return null;
  }
}

export function isDeliveryTerminal(status: DeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'REJECTED';
}

/**
 * Les cinq étapes affichées au client dans l'écran de suivi.
 * Volontairement plus grossières que les statuts internes : le client n'a que
 * faire de « HEADING_TO_RESTAURANT ».
 */
export const TRACKING_STEPS = [
  'RECEIVED',
  'PREPARING',
  'READY',
  'ON_THE_WAY',
  'DELIVERED',
] as const;
export type TrackingStep = (typeof TRACKING_STEPS)[number];

export function trackingStepFor(status: OrderStatus): TrackingStep {
  switch (status) {
    case 'NEW':
    case 'ACCEPTED':
      return 'RECEIVED';
    case 'PREPARING':
      return 'PREPARING';
    case 'READY':
    case 'ASSIGNED':
      return 'READY';
    case 'PICKED_UP':
      return 'ON_THE_WAY';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'RECEIVED';
  }
}

export function trackingProgress(status: OrderStatus): number {
  const index = TRACKING_STEPS.indexOf(trackingStepFor(status));
  return (index + 1) / TRACKING_STEPS.length;
}
