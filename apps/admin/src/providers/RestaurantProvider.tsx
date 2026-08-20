'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile, Restaurant, RestaurantRole, UUID } from '@istanbul/types';
import { queryKeys } from '@istanbul/core';

/**
 * L'établissement du dashboard : Istanbul, et lui seul.
 *
 * Ce contexte ne fait *aucune* requête. Tout ce qu'il expose vient du serveur,
 * résolu pendant le rendu du layout (`fn_dashboard_bootstrap`). C'est le
 * changement qui rend le dashboard rapide : la version précédente montait un
 * écran d'attente plein cadre, attendait l'hydratation, appelait
 * `fn_my_restaurants`, choisissait un établissement dans une liste — puis
 * seulement montait la page, qui partait alors chercher ses propres données.
 * Quatre allers-retours en série avant le premier chiffre à l'écran.
 *
 * Il reste un contexte plutôt qu'une constante importée : les droits (`access`)
 * dépendent du rôle de la personne connectée, et une bonne dizaine d'écrans
 * les lisent.
 */

export interface RestaurantAccess {
  /** Lire le tableau de bord, les commandes, les clients. */
  view: boolean;
  /** Menu, promotions, zones, livreurs, statuts de commande. */
  manage: boolean;
  /** Équipe et paramètres de l'établissement. */
  admin: boolean;
}

export interface RestaurantBootstrap {
  profile: Profile;
  restaurant: Restaurant;
  role: RestaurantRole | null;
  isAdmin: boolean;
}

interface RestaurantContextValue {
  restaurantId: UUID;
  restaurant: Restaurant;
  role: RestaurantRole | null;
  access: RestaurantAccess;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({
  bootstrap,
  children,
}: {
  bootstrap: RestaurantBootstrap;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { profile, restaurant, role, isAdmin } = bootstrap;

  // Amorçage du cache React Query, de façon synchrone : les hooks partagés
  // (`useRestaurant`, `useProfile`) trouvent la donnée déjà là et n'ouvrent pas
  // une requête pour ce que le serveur vient d'envoyer dans le HTML.
  // `useState(initialiseur)` plutôt qu'un `useEffect` : l'effet s'exécuterait
  // après le premier rendu des enfants, donc après le départ des requêtes.
  useState(() => {
    queryClient.setQueryData(queryKeys.restaurant(restaurant.id), restaurant);
    queryClient.setQueryData(queryKeys.profile(), profile);
  });

  const value = useMemo<RestaurantContextValue>(() => {
    // Un compte ADMIN de l'application administre le restaurant même sans
    // ligne dans `restaurant_members` : c'est le compte du patron.
    const access: RestaurantAccess = {
      view: true,
      manage: isAdmin || role === 'OWNER' || role === 'MANAGER',
      admin: isAdmin || role === 'OWNER',
    };

    return { restaurantId: restaurant.id, restaurant, role, access };
  }, [restaurant, role, isAdmin]);

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurantContext(): RestaurantContextValue {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurantContext doit être utilisé sous <RestaurantProvider>.');
  }
  return context;
}

/** Droits de l'utilisateur sur l'établissement. */
export function useRestaurantAccess(): RestaurantAccess {
  return useRestaurantContext().access;
}
