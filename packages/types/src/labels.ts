import type {
  DeliveryStatus,
  DriverAvailability,
  EffectiveRestaurantRole,
  FulfillmentType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  VehicleType,
} from './enums';
import type { TrackingStep } from './state-machine';

/**
 * Libellés français.
 *
 * Centralisés ici pour que le dashboard, l'app client et l'app livreur ne
 * traduisent jamais un statut différemment. Le jour où l'on ajoute le lingala
 * ou le swahili, ce fichier devient une table de traduction.
 */

export const orderStatusLabel: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  ACCEPTED: 'Acceptée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  ASSIGNED: 'Livreur assigné',
  PICKED_UP: 'En route',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

/** Formulation orientée client — « Nouvelle » ne veut rien dire pour lui. */
export const orderStatusCustomerLabel: Record<OrderStatus, string> = {
  NEW: 'Commande envoyée',
  ACCEPTED: 'Commande confirmée',
  PREPARING: 'En cuisine',
  READY: 'Prête',
  ASSIGNED: 'Livreur en route vers le restaurant',
  PICKED_UP: 'Votre livreur arrive',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

/** Verbe d'action affiché sur le bouton du dashboard. */
export const orderNextActionLabel: Partial<Record<OrderStatus, string>> = {
  NEW: 'Accepter',
  ACCEPTED: 'Mettre en préparation',
  PREPARING: 'Marquer prête',
  READY: 'Assigner un livreur',
  ASSIGNED: 'Marquer récupérée',
  PICKED_UP: 'Marquer livrée',
};

export const deliveryStatusLabel: Record<DeliveryStatus, string> = {
  OFFERED: 'Proposée',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  HEADING_TO_RESTAURANT: 'En route vers le restaurant',
  PICKED_UP: 'Commande récupérée',
  HEADING_TO_CUSTOMER: 'En route vers le client',
  ARRIVED: 'Arrivé',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

/** Bouton d'action du livreur pour l'étape suivante. */
export const deliveryNextActionLabel: Partial<Record<DeliveryStatus, string>> = {
  OFFERED: 'Accepter la course',
  ACCEPTED: 'Je pars au restaurant',
  HEADING_TO_RESTAURANT: "J'ai récupéré la commande",
  PICKED_UP: 'Je pars chez le client',
  HEADING_TO_CUSTOMER: 'Je suis arrivé',
  ARRIVED: 'Confirmer la livraison',
};

export const trackingStepLabel: Record<TrackingStep, string> = {
  RECEIVED: 'Commande reçue',
  PREPARING: 'Préparation',
  READY: 'Commande prête',
  ON_THE_WAY: 'Livreur en route',
  DELIVERED: 'Livrée',
};

export const fulfillmentLabel: Record<FulfillmentType, string> = {
  DELIVERY: 'Livraison',
  PICKUP: 'Retrait sur place',
};

export const paymentProviderLabel: Record<PaymentProvider, string> = {
  CASH: 'Paiement à la livraison',
  MPESA: 'M-Pesa',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
  CARD: 'Carte bancaire',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
  AUTHORIZED: 'Autorisé',
  PAID: 'Payé',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
};

export const driverAvailabilityLabel: Record<DriverAvailability, string> = {
  OFFLINE: 'Hors ligne',
  AVAILABLE: 'Disponible',
  BUSY: 'En course',
};

export const vehicleLabel: Record<VehicleType, string> = {
  MOTORCYCLE: 'Moto',
  BICYCLE: 'Vélo',
  CAR: 'Voiture',
  ON_FOOT: 'À pied',
};

/**
 * Ton sémantique associé à un statut.
 * Sert à choisir un token de couleur — l'information n'est jamais portée par
 * la couleur seule, un libellé l'accompagne toujours.
 */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const orderStatusTone: Record<OrderStatus, StatusTone> = {
  NEW: 'warning',
  ACCEPTED: 'info',
  PREPARING: 'info',
  READY: 'info',
  ASSIGNED: 'info',
  PICKED_UP: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export const deliveryStatusTone: Record<DeliveryStatus, StatusTone> = {
  OFFERED: 'warning',
  ACCEPTED: 'info',
  REJECTED: 'danger',
  HEADING_TO_RESTAURANT: 'info',
  PICKED_UP: 'info',
  HEADING_TO_CUSTOMER: 'info',
  ARRIVED: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/**
 * Rôles au sein d'un établissement.
 *
 * Le libellé dit ce que la personne *peut faire*, pas son titre : « Gérant »
 * et « Équipe » sont plus parlants pour un propriétaire de fast-food que
 * MANAGER et STAFF, et la description lève l'ambiguïté au moment de choisir.
 */
export const restaurantRoleLabel: Record<EffectiveRestaurantRole, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Gérant',
  STAFF: 'Équipe',
  PLATFORM: 'Plateforme',
};

export const restaurantRoleDescription: Record<EffectiveRestaurantRole, string> = {
  OWNER: 'Tout, y compris l’équipe et les paramètres de l’établissement.',
  MANAGER: 'Menu, promotions, zones, livreurs et commandes. Pas l’équipe.',
  STAFF: 'Commandes du jour et disponibilité des produits.',
  PLATFORM: 'Administration de la plateforme : accès à tous les partenaires.',
};

export const restaurantRoleTone: Record<EffectiveRestaurantRole, StatusTone> = {
  OWNER: 'success',
  MANAGER: 'info',
  STAFF: 'neutral',
  PLATFORM: 'warning',
};
