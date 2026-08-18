import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Minus, Plus, Trash } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  /** Affiche une corbeille au lieu du « − » quand on est au minimum. */
  deletable?: boolean;
  onDelete?: () => void;
  style?: ViewStyle;
}

/**
 * Sélecteur de quantité.
 *
 * Chaque bouton fait 44×44 minimum, même en taille `sm` où l'icône est plus
 * petite : le `hitSlop` compense. C'est le composant le plus manipulé du
 * panier, il n'a pas droit à l'à-peu-près.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  deletable = false,
  onDelete,
  style,
}: QuantityStepperProps) {
  const theme = useTheme();
  const button = size === 'sm' ? 32 : 40;
  const icon = size === 'sm' ? theme.iconSize.xs : theme.iconSize.sm;
  const slop = Math.max(0, (44 - button) / 2);

  const atMin = value <= min;
  const showDelete = deletable && atMin;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          padding: 3,
        },
        style,
      ]}
    >
      <Pressable
        onPress={() => (showDelete ? onDelete?.() : onChange(Math.max(min, value - 1)))}
        disabled={atMin && !showDelete}
        hitSlop={slop}
        accessibilityLabel={showDelete ? "Retirer l'article" : 'Diminuer la quantité'}
        style={[
          styles.button,
          {
            width: button,
            height: button,
            borderRadius: button / 2,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        {showDelete ? (
          <Trash size={icon} color={theme.colors.danger} />
        ) : (
          <Minus
            size={icon}
            color={atMin ? theme.colors.disabledText : theme.colors.text}
            weight="bold"
          />
        )}
      </Pressable>

      <Text
        variant={size === 'sm' ? 'labelStrong' : 'bodyStrong'}
        tabular
        align="center"
        accessibilityLabel={`Quantité : ${value}`}
        style={{ minWidth: 32 }}
      >
        {value}
      </Text>

      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        hitSlop={slop}
        accessibilityLabel="Augmenter la quantité"
        style={[
          styles.button,
          {
            width: button,
            height: button,
            borderRadius: button / 2,
            backgroundColor: value >= max ? theme.colors.surface : theme.colors.primary,
          },
        ]}
      >
        <Plus
          size={icon}
          color={value >= max ? theme.colors.disabledText : theme.colors.textOnPrimary}
          weight="bold"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  button: { alignItems: 'center', justifyContent: 'center' },
});
