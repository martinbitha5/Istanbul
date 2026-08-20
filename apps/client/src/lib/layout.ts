import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@istanbul/ui';

/**
 * Constantes de mise en page partagées.
 *
 * Avant ce fichier, chaque écran réinventait le padding bas de sa liste
 * (96, 110, 120, 130…) et recopiait `bottomOffset={58}` : la moindre retouche
 * de la tab bar aurait cassé cinq écrans. Une seule source de vérité ici.
 */

/** Hauteur de la barre d'onglets (hors inset système) — voir `(tabs)/_layout.tsx`. */
export const TAB_BAR_HEIGHT = 58;

/** Hauteur de la barre de panier flottante (`CartBar` de @istanbul/ui). */
export const CART_BAR_HEIGHT = 58;

/**
 * Réserve de défilement des écrans à `BottomBar` en flux (panier, checkout) :
 * la barre ne recouvre pas le contenu, on garde seulement un souffle constant
 * pour que le dernier bloc ne colle jamais à la barre d'action.
 */
export const BOTTOM_BAR_INSET = CART_BAR_HEIGHT;

/**
 * Padding bas d'une liste d'onglet surplombée par la CartBar flottante.
 *
 * Reproduit exactement la position de la barre (offset tab bar + inset système
 * + hauteur de barre) plus un souffle : le dernier élément reste lisible
 * au-dessus d'elle quel que soit le téléphone.
 */
export function useCartBarListPadding(cartVisible: boolean): number {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!cartVisible) return theme.spacing.xl;
  return (
    TAB_BAR_HEIGHT + Math.max(insets.bottom, theme.spacing.md) + CART_BAR_HEIGHT + theme.spacing.md
  );
}
