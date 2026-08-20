'use client';

import { useRestaurantContext } from '@/providers/RestaurantProvider';

/**
 * Identifiant du restaurant.
 *
 * Raccourci sur `RestaurantProvider`, conservé parce que la moitié des pages
 * du dashboard l'appellent. La valeur est résolue côté serveur avant le
 * premier rendu : elle n'est jamais vide, et les hooks React Query qui la
 * reçoivent n'ont pas à se garder contre le cas nul.
 *
 * Il n'y a plus de repli sur `NEXT_PUBLIC_RESTAURANT_ID` : l'établissement est
 * la seule ligne de la table `restaurants`, lue à l'amorçage. Un identifiant
 * en dur dans l'environnement, c'était un dashboard silencieusement vide le
 * jour où la variable manquait au déploiement.
 */
export function useRestaurantId(): string {
  return useRestaurantContext().restaurantId;
}
