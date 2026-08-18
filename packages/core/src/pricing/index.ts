import type {
  CartLine,
  CartOptionSelection,
  Cents,
  DeliveryQuote,
  Product,
  ProductOptionGroup,
  PromotionEvaluation,
} from '@istanbul/types';

/**
 * Moteur de prix.
 *
 * Fonctions pures, sans dépendance réseau : elles servent à afficher un total
 * instantanément pendant que l'utilisateur coche des options. Le total
 * définitif est recalculé par `fn_place_order` côté serveur — si les deux
 * divergent, c'est le serveur qui gagne et le panier est rafraîchi.
 */

/** Signature d'une ligne : même produit + mêmes options = même ligne. */
export function cartLineKey(productId: string, optionIds: string[], note?: string | null): string {
  const options = [...optionIds].sort().join(',');
  return `${productId}|${options}|${note?.trim() ?? ''}`;
}

export function optionsPrice(options: CartOptionSelection[]): Cents {
  return options.reduce((sum, option) => sum + option.price_delta, 0);
}

export function lineUnitPrice(line: CartLine): Cents {
  return line.unit_price + optionsPrice(line.options);
}

export function lineTotal(line: CartLine): Cents {
  return lineUnitPrice(line) * line.quantity;
}

export function cartSubtotal(lines: CartLine[]): Cents {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export interface OrderTotals {
  subtotal: Cents;
  deliveryFee: Cents;
  serviceFee: Cents;
  discount: Cents;
  total: Cents;
}

export interface ComputeTotalsInput {
  lines: CartLine[];
  /** null pour un retrait sur place. */
  deliveryQuote?: DeliveryQuote | null;
  promotion?: PromotionEvaluation | null;
  /** Frais de service du restaurant, en points de base. */
  serviceFeeBps?: number;
}

/** Réplique exacte du calcul de `fn_place_order`. */
export function computeTotals({
  lines,
  deliveryQuote,
  promotion,
  serviceFeeBps = 0,
}: ComputeTotalsInput): OrderTotals {
  const subtotal = cartSubtotal(lines);
  const deliveryFee = deliveryQuote?.in_range ? deliveryQuote.fee_amount : 0;
  // Division entière, comme en SQL — pas d'arrondi bancaire qui ferait dériver
  // le total client du total serveur d'un centime.
  const serviceFee = Math.trunc((subtotal * serviceFeeBps) / 10000);

  const rawDiscount = promotion?.is_valid ? promotion.discount_amount : 0;
  const discount = Math.min(rawDiscount, subtotal + deliveryFee + serviceFee);

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total: subtotal + deliveryFee + serviceFee - discount,
  };
}

// ---------------------------------------------------------------------------
// Validation des options avant ajout au panier
// ---------------------------------------------------------------------------

export interface OptionValidationError {
  groupId: string;
  groupName: string;
  message: string;
}

/**
 * Vérifie qu'une sélection respecte les contraintes des groupes d'options.
 * Renvoie la liste des problèmes ; vide = la sélection est valide.
 */
export function validateOptionSelection(
  groups: ProductOptionGroup[],
  selectedIds: string[],
): OptionValidationError[] {
  const errors: OptionValidationError[] = [];
  const selected = new Set(selectedIds);

  for (const group of groups) {
    const count = group.options.filter((option) => selected.has(option.id)).length;

    if (group.is_required && count < Math.max(1, group.min_select)) {
      errors.push({
        groupId: group.id,
        groupName: group.name,
        message:
          group.min_select > 1
            ? `Choisissez au moins ${group.min_select} options dans « ${group.name} ».`
            : `Choisissez une option dans « ${group.name} ».`,
      });
      continue;
    }

    if (count > group.max_select) {
      errors.push({
        groupId: group.id,
        groupName: group.name,
        message: `Maximum ${group.max_select} option${group.max_select > 1 ? 's' : ''} dans « ${group.name} ».`,
      });
    }
  }

  return errors;
}

/** Pré-sélection à l'ouverture d'une fiche produit : les options `is_default`. */
export function defaultSelection(groups: ProductOptionGroup[]): string[] {
  return groups.flatMap((group) => {
    const defaults = group.options.filter((option) => option.is_default && option.is_available);
    if (defaults.length > 0) {
      return group.selection_type === 'SINGLE'
        ? [defaults[0]!.id]
        : defaults.slice(0, group.max_select).map((option) => option.id);
    }
    // Un groupe obligatoire sans défaut explicite prend sa première option :
    // l'utilisateur ne doit jamais arriver sur un formulaire déjà invalide.
    if (group.is_required) {
      const first = group.options.find((option) => option.is_available);
      return first ? [first.id] : [];
    }
    return [];
  });
}

/** Applique un choix en respectant SINGLE / MULTIPLE et le plafond du groupe. */
export function toggleOption(
  group: ProductOptionGroup,
  currentIds: string[],
  optionId: string,
): string[] {
  const groupOptionIds = new Set(group.options.map((option) => option.id));
  const outside = currentIds.filter((id) => !groupOptionIds.has(id));
  const inside = currentIds.filter((id) => groupOptionIds.has(id));

  if (group.selection_type === 'SINGLE') {
    // Un groupe obligatoire ne peut pas être vidé par un second tap.
    if (inside.includes(optionId) && !group.is_required) return outside;
    return [...outside, optionId];
  }

  if (inside.includes(optionId)) {
    return [...outside, ...inside.filter((id) => id !== optionId)];
  }
  if (inside.length >= group.max_select) {
    return currentIds; // plafond atteint : on ignore, sans erreur bruyante
  }
  return [...outside, ...inside, optionId];
}

/** Prix affiché sur une fiche produit, options comprises. */
export function productPriceWithOptions(
  product: Pick<Product, 'base_price'>,
  groups: ProductOptionGroup[],
  selectedIds: string[],
  quantity = 1,
): Cents {
  const selected = new Set(selectedIds);
  const delta = groups
    .flatMap((group) => group.options)
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + option.price_delta, 0);

  return (product.base_price + delta) * quantity;
}

/** Montant restant pour atteindre la livraison offerte. `null` si non applicable. */
export function amountToFreeDelivery(subtotal: Cents, freeAbove: Cents | null): Cents | null {
  if (freeAbove == null || subtotal >= freeAbove) return null;
  return freeAbove - subtotal;
}
