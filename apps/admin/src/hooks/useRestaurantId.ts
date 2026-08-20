'use client';

import { useRestaurantContext } from '@/providers/RestaurantProvider';

/**
 * Établissement courant.
 *
 * Simple raccourci sur `RestaurantProvider`, conservé parce que la moitié des
 * pages du dashboard l'appellent. Le provider garantit qu'aucune page n'est
 * montée avant qu'un établissement soit choisi : la valeur n'est donc jamais
 * vide ici, et les hooks React Query qui la reçoivent n'ont pas à se garder
 * contre le cas nul.
 *
 * Il n'y a plus de repli sur `NEXT_PUBLIC_RESTAURANT_ID` : un identifiant en
 * dur était une bombe à retardement en multi-restaurants — sur un compte mal
 * rattaché, le dashboard affichait sereinement les commandes d'un autre
 * partenaire.
 */
export function useRestaurantId(): string {
  return useRestaurantContext().restaurantId;
}
