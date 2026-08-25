import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CountBadge } from './Badge';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface FloatingTabItem {
  key: string;
  /** Libellé accessible. Affiché seulement sur l'onglet `wide`. */
  label: string;
  icon: (state: { color: string; focused: boolean; size: number }) => React.ReactNode;
  focused: boolean;
  onPress: () => void;
  /**
   * Rendu en pilule large avec son libellé, au lieu d'un disque.
   *
   * Réservé à la recherche : c'est l'onglet dont on veut qu'il soit reconnu
   * sans être lu, et l'élargir est ce qui le distingue des quatre autres.
   */
  wide?: boolean;
  /** Pastille verte de comptage — le panier. */
  badgeCount?: number;
}

export interface FloatingTabBarProps {
  items: FloatingTabItem[];
  style?: ViewStyle;
}

/**
 * Barre d'onglets flottante.
 *
 * Ce n'est pas une barre : ce sont cinq contrôles indépendants posés au-dessus
 * du contenu, sans fond commun, sans filet supérieur. Le contenu défile
 * visiblement dessous et derrière eux, ce qui rend à l'écran les 80 pt qu'une
 * barre opaque lui confisque — sur un téléphone d'entrée de gamme kinois, ces
 * 80 pt valent une carte de plat de plus par écran.
 *
 * Conséquence à ne pas oublier côté écrans : puisque rien ne masque le bas de
 * la liste, chaque liste doit réserver `TAB_BAR_HEIGHT` de padding en pied,
 * sinon son dernier élément finit sous les pastilles.
 */
export function FloatingTabBar({ items, style }: FloatingTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Sans onglet large, rien ne prend le `flex: 1` et les pastilles se
  // tasseraient à gauche : on les centre. Avec, la recherche occupe l'espace
  // restant et la rangée se répartit toute seule.
  const hasWide = items.some((item) => item.wide);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingHorizontal: theme.spacing.md,
          paddingBottom: Math.max(insets.bottom, theme.spacing.md),
          gap: theme.spacing.sm,
          justifyContent: hasWide ? 'flex-start' : 'center',
        },
        style,
      ]}
    >
      {items.map((item) => {
        // L'icône est noire quand l'onglet est actif, grise sinon : dans une
        // interface sans couleur, c'est le poids du trait qui porte l'état, et
        // les icônes reçoivent aussi `focused` pour passer en version pleine.
        const color = item.focused ? theme.colors.text : theme.colors.textMuted;

        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            accessibilityLabel={item.label}
            style={[
              styles.control,
              item.wide ? styles.wide : styles.disc,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.pill,
                paddingHorizontal: item.wide ? theme.spacing.base : 0,
              },
              theme.elevation[3],
            ]}
          >
            {item.icon({ color, focused: item.focused, size: theme.iconSize.md })}

            {item.wide ? (
              <Text
                variant="body"
                numberOfLines={1}
                style={{ color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}
              >
                {item.label}
              </Text>
            ) : null}

            {item.badgeCount ? (
              <View style={styles.badge}>
                <CountBadge count={item.badgeCount} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Hauteur réservée sous les listes.
 *
 * 56 pour les pastilles + 12 de marge basse. Les écrans y ajoutent l'inset de
 * la zone de geste, qu'ils lisent eux-mêmes.
 */
export const FLOATING_TAB_BAR_HEIGHT = 68;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56 },
  disc: { width: 56 },
  // La recherche prend toute la place restante : c'est ce qui la fait lire
  // comme un champ plutôt que comme un sixième bouton.
  wide: { flex: 1 },
  badge: { position: 'absolute', top: 6, right: 6 },
});
