import React, { useCallback } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  /** StyleProp : accepte les tableaux avec conditions (`cond && style`). */
  style?: StyleProp<ViewStyle>;
  /** Désactive l'échelle de pression (barres pleine largeur, lignes de liste). */
  noScale?: boolean;
  /** Opacité au lieu de l'échelle — pour les éléments déjà animés par ailleurs. */
  fade?: boolean;
  children?: React.ReactNode;
}

/**
 * Élément pressable de l'application.
 *
 * Le retour tactile passe par `scale`, jamais par une translation : déplacer
 * un élément décale ses voisins et produit le tremblement caractéristique
 * d'une interface bâclée. `prefers-reduced-motion` supprime l'échelle et ne
 * conserve qu'un changement d'opacité.
 */
export function Pressable({
  style,
  noScale = false,
  fade = false,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback<NonNullable<RNPressableProps['onPressIn']>>(
    (event) => {
      if (!noScale && !reducedMotion) {
        scale.value = withSpring(theme.pressScale, theme.spring.snappy);
      }
      if (fade || reducedMotion) {
        opacity.value = withTiming(0.7, { duration: theme.duration.instant });
      }
      onPressIn?.(event);
    },
    [fade, noScale, onPressIn, opacity, reducedMotion, scale, theme],
  );

  const handlePressOut = useCallback<NonNullable<RNPressableProps['onPressOut']>>(
    (event) => {
      scale.value = withSpring(1, theme.spring.snappy);
      opacity.value = withTiming(1, { duration: theme.duration.fast });
      onPressOut?.(event);
    },
    [onPressOut, opacity, scale, theme],
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
      // Android : ripple aligné sur la couleur de marque.
      android_ripple={
        noScale ? { color: theme.colors.primarySoft, borderless: false } : undefined
      }
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
