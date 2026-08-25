import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /**
   * Forme. Par défaut, elle se déduit de la largeur — voir le commentaire du
   * composant. À ne forcer que pour aller contre cette règle en connaissance
   * de cause.
   */
  shape?: 'rounded' | 'pill';
  /** Icône rendue à gauche du libellé. */
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Second texte aligné à droite — typiquement le total du panier. */
  trailing?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

/**
 * Bouton.
 *
 * Un seul bouton `primary` par écran : c'est la règle qui garde l'interface
 * lisible. Les actions secondaires prennent `secondary` ou `ghost`.
 *
 * Deux points hérités de la référence, contre-intuitifs tant qu'on ne les a
 * pas vus côte à côte :
 *
 *  - **Le primaire est noir**, pas coloré. Le vert de marque ne sert jamais de
 *    fond de bouton — il resterait un signal, et un signal partout ne signale
 *    plus rien.
 *  - **La forme dépend de la largeur.** Un bouton pleine largeur ancré en bas
 *    prend le rayon 8 ; un bouton qui se dimensionne sur son texte prend la
 *    pilule. Uber applique cette règle sans exception, et c'est elle qui fait
 *    qu'un « Commander » flottant et un « Commander et payer » ancré ne se
 *    ressemblent pas par accident.
 *
 * Aucune ombre nulle part : les boutons sont plats, c'est le contraste du
 * noir sur blanc qui les fait ressortir.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  shape,
  icon,
  iconRight,
  trailing,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const isInactive = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: theme.colors.primary, fg: theme.colors.textOnPrimary },
    accent: { bg: theme.colors.accent, fg: theme.colors.textOnAccent },
    // Aplat gris, pas un contour : c'est la forme qu'ont « Continuer avec
    // Apple » ou « Afficher l'offre du magasin ». Un bouton bordé jurerait
    // dans une interface qui n'a presque aucune bordure.
    secondary: { bg: theme.colors.surfaceSunken, fg: theme.colors.text },
    ghost: { bg: 'transparent', fg: theme.colors.text },
    danger: { bg: theme.colors.danger, fg: theme.colors.textInverse },
  };

  const { bg, fg } = palette[variant];
  const isPill = (shape ?? (fullWidth ? 'rounded' : 'pill')) === 'pill';

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[
        styles.base,
        {
          height: HEIGHTS[size],
          paddingHorizontal: size === 'sm' ? theme.spacing.base : theme.spacing.xl,
          borderRadius: isPill ? theme.radius.pill : theme.radius.md,
          // `ghost` reste transparent une fois inactif : un bouton texte
          // désactivé ne doit pas se matérialiser en pavé gris.
          backgroundColor: isInactive && variant !== 'ghost' ? theme.colors.disabled : bg,
        },
        fullWidth && styles.fullWidth,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isInactive ? theme.colors.disabledText : fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={{ marginRight: theme.spacing.sm }}>{icon}</View> : null}

          <Text
            variant={size === 'sm' ? 'buttonSmall' : 'button'}
            style={{ color: isInactive ? theme.colors.disabledText : fg }}
            numberOfLines={1}
          >
            {label}
          </Text>

          {iconRight ? <View style={{ marginLeft: theme.spacing.sm }}>{iconRight}</View> : null}

          {trailing ? (
            <Text
              variant="button"
              tabular
              style={{
                color: isInactive ? theme.colors.disabledText : fg,
                marginLeft: theme.spacing.md,
              }}
            >
              {trailing}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
