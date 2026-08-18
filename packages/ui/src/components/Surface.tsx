import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import type { ElevationLevel, RadiusToken, SpacingToken } from '@istanbul/tokens';
import { useTheme } from '../theme/ThemeProvider';

export interface SurfaceProps extends ViewProps {
  elevation?: ElevationLevel;
  radius?: RadiusToken;
  padding?: SpacingToken;
  bordered?: boolean;
  /** Fond légèrement enfoncé — sections, listes internes. */
  sunken?: boolean;
  children?: React.ReactNode;
}

/** Conteneur de base : carte, panneau, section. */
export function Surface({
  elevation = 1,
  radius = 'lg',
  padding,
  bordered = false,
  sunken = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: sunken ? theme.colors.surfaceSunken : theme.colors.surface,
          borderRadius: theme.radius[radius],
          padding: padding ? theme.spacing[padding] : undefined,
          borderWidth: bordered ? theme.borderWidth.hairline : 0,
          borderColor: theme.colors.border,
        },
        theme.elevation[elevation],
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export interface DividerProps {
  spacing?: SpacingToken;
  inset?: number;
}

export function Divider({ spacing = 'none', inset = 0 }: DividerProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: theme.borderWidth.hairline,
        backgroundColor: theme.colors.divider,
        marginVertical: theme.spacing[spacing],
        marginLeft: inset,
      }}
    />
  );
}

/** Espace vertical explicite — plus lisible qu'une marge perdue dans un style. */
export function Spacer({ size = 'base' }: { size?: SpacingToken }) {
  const theme = useTheme();
  return <View style={{ height: theme.spacing[size] }} />;
}
