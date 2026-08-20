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
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconRight,
  trailing,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const isInactive = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.colors.primary, fg: theme.colors.textOnPrimary },
    accent: { bg: theme.colors.accent, fg: theme.colors.textOnAccent },
    secondary: {
      bg: 'transparent',
      fg: theme.colors.text,
      border: theme.colors.borderStrong,
    },
    ghost: { bg: 'transparent', fg: theme.colors.primary },
    danger: { bg: theme.colors.danger, fg: theme.colors.textOnPrimary },
  };

  const { bg, fg, border } = palette[variant];

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
          borderRadius: theme.radius.pill,
          // Les variantes transparentes le restent quand elles sont inactives :
          // un `secondary` désactivé ne doit pas devenir un pavé gris plein.
          backgroundColor:
            isInactive && variant !== 'ghost' && variant !== 'secondary'
              ? theme.colors.disabled
              : bg,
          borderWidth: border ? theme.borderWidth.thin : 0,
          borderColor: isInactive && border ? theme.colors.border : border,
        },
        fullWidth && styles.fullWidth,
        variant === 'primary' && !isInactive && theme.elevation[2],
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
