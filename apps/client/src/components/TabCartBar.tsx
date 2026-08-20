import { router } from 'expo-router';
import {
  cartItemCount,
  cartSubtotal,
  formatMoney,
  useCartStore,
  useRestaurant,
} from '@istanbul/core';
import { CartBar } from '@istanbul/ui';
import { useRestaurantId } from '@/store/restaurant';
import { TAB_BAR_HEIGHT } from '@/lib/layout';

/** Nombre d'articles au panier — pour dimensionner le padding bas des listes. */
export function useCartItemCount(): number {
  const lines = useCartStore((state) => state.lines);
  return cartItemCount(lines);
}

/**
 * Barre de panier flottante des écrans à onglets.
 *
 * Le bloc lignes + compte + sous-total + CartBar était recopié dans trois
 * onglets, chacun avec son `bottomOffset` en dur. Ici, une seule source :
 * l'offset vient de `TAB_BAR_HEIGHT` et la devise du restaurant actif.
 */
export function TabCartBar() {
  const restaurantId = useRestaurantId();
  const { data: restaurant } = useRestaurant(restaurantId);
  const lines = useCartStore((state) => state.lines);

  return (
    <CartBar
      itemCount={cartItemCount(lines)}
      total={cartSubtotal(lines)}
      onPress={() => router.push('/cart')}
      formatMoney={(cents) => formatMoney(cents, restaurant?.currency)}
      bottomOffset={TAB_BAR_HEIGHT}
    />
  );
}
