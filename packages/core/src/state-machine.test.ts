import { describe, expect, it } from 'vitest';
import {
  canTransitionDelivery,
  canTransitionOrder,
  customerCanCancel,
  isDeliveryTerminal,
  isOrderTerminal,
  nextDeliveryStatus,
  nextOrderStatus,
  trackingProgress,
  trackingStepFor,
  type DeliveryStatus,
  type OrderStatus,
} from '@istanbul/types';

/**
 * Miroir de `fn_order_can_transition` / `fn_delivery_can_transition` : si un
 * test casse ici, vérifier que la fonction SQL correspondante raconte bien la
 * même histoire — c'est le serveur qui a le dernier mot.
 */

describe('machine à états — commande', () => {
  it('suit le chemin nominal DELIVERY de bout en bout', () => {
    const path: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionOrder(path[i]!, path[i + 1]!, 'DELIVERY')).toBe(true);
      expect(nextOrderStatus(path[i]!, 'DELIVERY')).toBe(path[i + 1]);
    }
  });

  it('en PICKUP, READY va directement à DELIVERED — jamais à ASSIGNED', () => {
    expect(canTransitionOrder('READY', 'DELIVERED', 'PICKUP')).toBe(true);
    expect(canTransitionOrder('READY', 'ASSIGNED', 'PICKUP')).toBe(false);
    expect(nextOrderStatus('READY', 'PICKUP')).toBe('DELIVERED');
  });

  it('en DELIVERY, READY ne saute jamais directement à DELIVERED', () => {
    expect(canTransitionOrder('READY', 'DELIVERED', 'DELIVERY')).toBe(false);
  });

  it('interdit les sauts et les retours en arrière', () => {
    expect(canTransitionOrder('NEW', 'READY', 'DELIVERY')).toBe(false);
    expect(canTransitionOrder('PREPARING', 'ACCEPTED', 'DELIVERY')).toBe(false);
    expect(canTransitionOrder('DELIVERED', 'CANCELLED', 'DELIVERY')).toBe(false);
  });

  it('est idempotente : un double tap ne change rien', () => {
    expect(canTransitionOrder('PREPARING', 'PREPARING', 'DELIVERY')).toBe(true);
  });

  it('les états terminaux ne bougent plus', () => {
    expect(isOrderTerminal('DELIVERED')).toBe(true);
    expect(isOrderTerminal('CANCELLED')).toBe(true);
    expect(isOrderTerminal('READY')).toBe(false);
    expect(nextOrderStatus('DELIVERED', 'DELIVERY')).toBeNull();
  });

  it('le client ne peut annuler que tant que la cuisine n’a pas commencé', () => {
    expect(customerCanCancel('NEW')).toBe(true);
    expect(customerCanCancel('ACCEPTED')).toBe(true);
    expect(customerCanCancel('PREPARING')).toBe(false);
    expect(customerCanCancel('PICKED_UP')).toBe(false);
  });
});

describe('machine à états — livraison', () => {
  it('suit le chemin nominal du livreur', () => {
    const path: DeliveryStatus[] = [
      'OFFERED',
      'ACCEPTED',
      'HEADING_TO_RESTAURANT',
      'PICKED_UP',
      'HEADING_TO_CUSTOMER',
      'ARRIVED',
      'DELIVERED',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionDelivery(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('une offre peut être refusée, un refus est terminal', () => {
    expect(canTransitionDelivery('OFFERED', 'REJECTED')).toBe(true);
    expect(canTransitionDelivery('REJECTED', 'ACCEPTED')).toBe(false);
    expect(isDeliveryTerminal('REJECTED')).toBe(true);
  });

  it('ARRIVED précède obligatoirement DELIVERED (le code du client)', () => {
    expect(canTransitionDelivery('HEADING_TO_CUSTOMER', 'DELIVERED')).toBe(false);
    expect(nextDeliveryStatus('ARRIVED')).toBe('DELIVERED');
  });

  it('une course livrée ne s’annule plus', () => {
    expect(canTransitionDelivery('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransitionDelivery('ARRIVED', 'CANCELLED')).toBe(true);
  });
});

describe('affichage du suivi client', () => {
  it('regroupe les statuts internes en cinq étapes lisibles', () => {
    expect(trackingStepFor('NEW')).toBe('RECEIVED');
    expect(trackingStepFor('ASSIGNED')).toBe('READY');
    expect(trackingStepFor('PICKED_UP')).toBe('ON_THE_WAY');
    expect(trackingStepFor('DELIVERED')).toBe('DELIVERED');
  });

  it('la progression est monotone le long du parcours', () => {
    const path: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'];
    const values = path.map(trackingProgress);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
    expect(values.at(-1)).toBe(1);
  });
});
