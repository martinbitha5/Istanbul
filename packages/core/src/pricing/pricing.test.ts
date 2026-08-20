import { describe, expect, it } from 'vitest';
import type { CartLine, DeliveryQuote, ProductOptionGroup, PromotionEvaluation } from '@istanbul/types';
import {
  amountToFreeDelivery,
  cartItemCount,
  cartLineKey,
  cartSubtotal,
  computeTotals,
  defaultSelection,
  lineTotal,
  toggleOption,
  validateOptionSelection,
} from './index';

/**
 * Le moteur de prix est la copie TypeScript de `fn_place_order` : chaque test
 * qui casse ici signale un écart possible entre le total affiché au client et
 * le total facturé par le serveur.
 */

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    key: 'k',
    product_id: 'p1',
    product_name: 'Shawarma',
    product_image: null,
    unit_price: 5000, // 50,00 $
    quantity: 1,
    options: [],
    note: null,
    ...overrides,
  };
}

const option = (id: string, price_delta: number) => ({
  option_id: id,
  group_id: 'g1',
  group_name: 'Suppléments',
  option_name: id,
  price_delta,
});

describe('cartLineKey', () => {
  it('est stable quel que soit l’ordre des options', () => {
    expect(cartLineKey('p1', ['b', 'a'])).toBe(cartLineKey('p1', ['a', 'b']));
  });

  it('sépare deux lignes du même produit avec des notes différentes', () => {
    expect(cartLineKey('p1', [], 'sans oignons')).not.toBe(cartLineKey('p1', []));
  });
});

describe('totaux de ligne et de panier', () => {
  it('multiplie (prix + options) par la quantité', () => {
    const l = line({ quantity: 3, options: [option('fromage', 500)] });
    expect(lineTotal(l)).toBe((5000 + 500) * 3);
  });

  it('additionne les lignes et compte les articles', () => {
    const lines = [line({ quantity: 2 }), line({ unit_price: 3000, quantity: 1 })];
    expect(cartSubtotal(lines)).toBe(13000);
    expect(cartItemCount(lines)).toBe(3);
  });
});

describe('computeTotals — réplique de fn_place_order', () => {
  const quote: DeliveryQuote = {
    zone_id: 'z1',
    zone_name: '0–3 km',
    distance_km: 2.1,
    fee_amount: 1500,
    eta_minutes: 35,
    in_range: true,
  };

  it('additionne sous-total + livraison + service', () => {
    const totals = computeTotals({
      lines: [line({ quantity: 2 })],
      deliveryQuote: quote,
      serviceFeeBps: 250, // 2,5 %
    });

    expect(totals.subtotal).toBe(10000);
    expect(totals.deliveryFee).toBe(1500);
    // Division entière comme en SQL : (10000 × 250) / 10000 = 250.
    expect(totals.serviceFee).toBe(250);
    expect(totals.total).toBe(11750);
  });

  it('ignore les frais de livraison hors zone', () => {
    const totals = computeTotals({
      lines: [line()],
      deliveryQuote: { ...quote, in_range: false },
    });
    expect(totals.deliveryFee).toBe(0);
  });

  it('tronque le frais de service comme la division entière SQL', () => {
    // 9999 × 250 / 10000 = 249,975 → 249 (jamais 250).
    const totals = computeTotals({
      lines: [line({ unit_price: 9999 })],
      serviceFeeBps: 250,
    });
    expect(totals.serviceFee).toBe(249);
  });

  it('plafonne la réduction à ce qui est dû', () => {
    const promo: PromotionEvaluation = {
      promotion_id: 'promo',
      title: 'Bienvenue',
      discount_amount: 999999,
      applies_to_delivery: false,
      is_valid: true,
      reason: null,
    };

    const totals = computeTotals({ lines: [line()], promotion: promo });
    expect(totals.discount).toBe(totals.subtotal);
    expect(totals.total).toBe(0);
  });

  it('ignore une promotion invalide', () => {
    const promo: PromotionEvaluation = {
      promotion_id: null,
      title: null,
      discount_amount: 1000,
      applies_to_delivery: false,
      is_valid: false,
      reason: 'expirée',
    };

    expect(computeTotals({ lines: [line()], promotion: promo }).discount).toBe(0);
  });
});

describe('validateOptionSelection', () => {
  const group = (overrides: Partial<ProductOptionGroup> = {}): ProductOptionGroup => ({
    id: 'g1',
    product_id: 'p1',
    name: 'Taille',
    description: null,
    selection_type: 'SINGLE',
    is_required: true,
    min_select: 1,
    max_select: 1,
    sort_order: 0,
    options: [
      { id: 'o1', group_id: 'g1', name: 'Normale', price_delta: 0, is_default: true, is_available: true, sort_order: 0 },
      { id: 'o2', group_id: 'g1', name: 'Grande', price_delta: 1000, is_default: false, is_available: true, sort_order: 1 },
    ],
    ...overrides,
  });

  it('exige une option dans un groupe obligatoire', () => {
    expect(validateOptionSelection([group()], [])).toHaveLength(1);
    expect(validateOptionSelection([group()], ['o1'])).toHaveLength(0);
  });

  it('refuse de dépasser le plafond du groupe', () => {
    const g = group({ selection_type: 'MULTIPLE', is_required: false, min_select: 0, max_select: 1 });
    expect(validateOptionSelection([g], ['o1', 'o2'])).toHaveLength(1);
  });
});

describe('toggleOption', () => {
  const single = {
    id: 'g1',
    product_id: 'p1',
    name: 'Taille',
    description: null,
    selection_type: 'SINGLE' as const,
    is_required: true,
    min_select: 1,
    max_select: 1,
    sort_order: 0,
    options: [
      { id: 'o1', group_id: 'g1', name: 'Normale', price_delta: 0, is_default: true, is_available: true, sort_order: 0 },
      { id: 'o2', group_id: 'g1', name: 'Grande', price_delta: 1000, is_default: false, is_available: true, sort_order: 1 },
    ],
  };

  it('remplace la sélection dans un groupe SINGLE', () => {
    expect(toggleOption(single, ['o1'], 'o2')).toEqual(['o2']);
  });

  it('ne vide pas un groupe SINGLE obligatoire par un second tap', () => {
    expect(toggleOption(single, ['o1'], 'o1')).toEqual(['o1']);
  });

  it('ignore un ajout au-delà du plafond en MULTIPLE', () => {
    const multiple = { ...single, selection_type: 'MULTIPLE' as const, is_required: false, max_select: 1 };
    expect(toggleOption(multiple, ['o1'], 'o2')).toEqual(['o1']);
  });
});

describe('defaultSelection', () => {
  it('prend la première option disponible d’un groupe obligatoire sans défaut', () => {
    const g: ProductOptionGroup = {
      id: 'g1',
      product_id: 'p1',
      name: 'Pain',
      description: null,
      selection_type: 'SINGLE',
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 0,
      options: [
        { id: 'o1', group_id: 'g1', name: 'Rupture', price_delta: 0, is_default: false, is_available: false, sort_order: 0 },
        { id: 'o2', group_id: 'g1', name: 'Libanais', price_delta: 0, is_default: false, is_available: true, sort_order: 1 },
      ],
    };
    expect(defaultSelection([g])).toEqual(['o2']);
  });
});

describe('amountToFreeDelivery', () => {
  it('calcule le restant, ou null si atteint / non applicable', () => {
    expect(amountToFreeDelivery(3000, 5000)).toBe(2000);
    expect(amountToFreeDelivery(5000, 5000)).toBeNull();
    expect(amountToFreeDelivery(3000, null)).toBeNull();
  });
});
