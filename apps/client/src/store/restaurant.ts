import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useCartStore } from '@istanbul/core';
import { config } from '@/lib/config';

/**
 * Restaurant sélectionné.
 *
 * Mono-restaurant aujourd'hui : la valeur par défaut vient de la config et le
 * sélecteur n'apparaît que si la base contient plusieurs restaurants. Le jour
 * où un deuxième point de vente ouvre, rien à déployer : il apparaît tout
 * seul dans l'app.
 *
 * Changer de restaurant vide le panier : les produits, prix et zones de
 * livraison n'ont aucune raison d'exister ailleurs.
 */

interface RestaurantState {
  restaurantId: string;
  setRestaurantId: (id: string) => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set, get) => ({
      restaurantId: config.restaurantId,
      setRestaurantId: (id) => {
        if (id === get().restaurantId) return;
        useCartStore.getState().clear();
        set({ restaurantId: id });
      },
    }),
    {
      name: 'istanbul.restaurant',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** L'identifiant du restaurant actif — remplace config.restaurantId partout. */
export function useRestaurantId(): string {
  return useRestaurantStore((state) => state.restaurantId);
}
