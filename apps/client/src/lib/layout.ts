import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT, useTheme } from '@istanbul/ui';

/**
 * Constantes de mise en page partagées.
 *
 * Avant ce fichier, chaque écran réinventait le padding bas de sa liste
 * (96, 110, 120, 130…) et recopiait `bottomOffset={58}` : la moindre retouche
 * de la tab bar aurait cassé cinq écrans. Une seule source de vérité ici.
 */

/** Hauteur de la barre d'onglets flottante (hors inset système). */
export const TAB_BAR_HEIGHT = FLOATING_TAB_BAR_HEIGHT;

/** Hauteur de la barre de panier flottante (`CartBar` de @istanbul/ui). */
export const CART_BAR_HEIGHT = 56;

/**
 * Réserve de défilement des écrans à `BottomBar` en flux (panier, checkout) :
 * la barre ne recouvre pas le contenu, on garde seulement un souffle constant
 * pour que le dernier bloc ne colle jamais à la barre d'action.
 */
export const BOTTOM_BAR_INSET = CART_BAR_HEIGHT;

/**
 * Padding bas d'une liste d'onglet.
 *
 * La barre d'onglets ne pose plus de fond opaque : elle flotte, et le contenu
 * défile derrière elle. Une liste doit donc réserver sa hauteur **en
 * permanence**, panier visible ou pas — c'est le prix de la barre flottante, et
 * l'oublier laisse le dernier plat de la liste caché sous les pastilles.
 */
export function useCartBarListPadding(cartVisible: boolean): number {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const base = TAB_BAR_HEIGHT + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.md;
  return cartVisible ? base + CART_BAR_HEIGHT + theme.spacing.sm : base;
}
