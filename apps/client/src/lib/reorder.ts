import { useCartStore } from '@istanbul/core';
import type { OrderDetail, ProductWithOptions } from '@istanbul/types';

export interface RefillResult {
  /** Nombre de lignes réinjectées au panier. */
  added: number;
  /** Produits supprimés du catalogue depuis (product_id nul), donc ignorés. */
  skipped: number;
  /** Au moins une ligne d'origine portait des options, non rejouées ici. */
  hadOptions: boolean;
}

/**
 * « Commander à nouveau » : réinjecte les lignes d'une commande dans le panier.
 *
 * On repart de l'instantané de la commande (nom, image, prix unitaire) sans
 * refetch produit — l'ancienne version montait une requête réseau PAR carte de
 * l'historique juste pour ce bouton. Les options ne sont PAS rejouées : le
 * snapshot ne porte plus les identifiants de groupe et les options ont pu
 * changer de prix ; on réinjecte produit + quantité et l'appelant affiche un
 * toast d'info pour inviter à revérifier. Le serveur revalide de toute façon
 * chaque prix au moment du checkout.
 */
export function refillCartFromOrder(order: OrderDetail): RefillResult {
  const addLine = useCartStore.getState().addLine;
  const items = order.items ?? [];

  let added = 0;
  let skipped = 0;
  let hadOptions = false;

  for (const item of items) {
    if (!item.product_id) {
      skipped += 1;
      continue;
    }
    if (item.options.length > 0) hadOptions = true;

    // `addLine` ne lit que ces champs du produit : un extrait de l'instantané
    // suffit, sans dépendre du fait que la fiche existe encore telle quelle.
    const productSnapshot = {
      id: item.product_id,
      name: item.product_name,
      image_url: item.product_image,
      base_price: item.unit_price,
      option_groups: [],
    } as unknown as ProductWithOptions;

    addLine(productSnapshot, [], item.quantity, item.note);
    added += 1;
  }

  return { added, skipped, hadOptions };
}
