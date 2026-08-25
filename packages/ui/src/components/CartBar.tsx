import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Price, Text } from './Text';

export interface CartBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
  formatMoney: (cents: number) => string;
  /** Hauteur de la tab bar sous la barre, pour ne pas la recouvrir. */
  bottomOffset?: number;
  label?: string;
}

/**
 * Barre de panier flottante.
 *
 * Toujours visible dès qu'il y a un article, toujours au-dessus de la tab bar,
 * toujours au-dessus de la zone de geste système. C'est le raccourci le plus
 * rentable de l'application : il ne doit jamais être masqué par un clavier ni
 * par une encoche.
 */
export function CartBar({
  itemCount,
  total,
  onPress,
  formatMoney,
  bottomOffset = 0,
  label = 'Voir le panier',
}: CartBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (itemCount <= 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(theme.duration.base)}
      exiting={FadeOutDown.duration(theme.duration.exit)}
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset + Math.max(insets.bottom, theme.spacing.md),
          paddingHorizontal: theme.screenPadding,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${label}, ${itemCount} article${itemCount > 1 ? 's' : ''}, ${formatMoney(total)}`}
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.spacing.lg,
          },
          theme.elevation[3],
        ]}
      >
        <ShoppingBag size={18} color={theme.colors.textOnPrimary} weight="fill" />

        {/* « Voir le panier • 3 » d'un seul tenant : la pastille translucide
            qu'il y avait ici découpait la barre en deux blocs pour afficher un
            chiffre que la phrase porte déjà. */}
        <Text
          variant="button"
          numberOfLines={1}
          style={{ color: theme.colors.textOnPrimary, flex: 1, marginLeft: theme.spacing.sm }}
        >
          {label} · <Text variant="button" tabular style={{ color: theme.colors.textOnPrimary }}>
            {itemCount}
          </Text>
        </Text>

        <Price style={{ color: theme.colors.textOnPrimary }}>{formatMoney(total)}</Price>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0 },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center' },
});
