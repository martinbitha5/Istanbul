import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT, useTheme } from '@istanbul/ui';

/**
 * Réserve de défilement sous les écrans à onglets.
 *
 * La barre d'onglets flotte au-dessus du contenu et ne pose aucun fond : sans
 * cette réserve, la dernière course de la liste finit cachée derrière les
 * pastilles. Elle se lit `paddingBottom: useTabBarPadding()` dans le
 * `contentContainerStyle` de chaque liste d'onglet.
 */
export function useTabBarPadding(): number {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return FLOATING_TAB_BAR_HEIGHT + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.md;
}
