import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import type { TextStyleToken } from '@istanbul/tokens';
import { useTheme } from '../theme/ThemeProvider';

type ColorToken =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'textInverse'
  | 'textOnPrimary'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface TextProps extends RNTextProps {
  variant?: TextStyleToken;
  color?: ColorToken;
  /** Chiffres à chasse fixe — obligatoire pour tout nombre qui change en place. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
  children?: React.ReactNode;
}

/**
 * Texte de l'application.
 *
 * Aucun écran ne doit importer `Text` de react-native : passer par les
 * variantes garantit que la typographie reste cohérente et que le Dynamic
 * Type est respecté partout de la même façon.
 */
export function Text({
  variant = 'body',
  color = 'text',
  tabular = false,
  align,
  uppercase = false,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const base = theme.text[variant];

  return (
    <RNText
      // Plafonne l'agrandissement système : au-delà, les prix et les CTA
      // débordent de leur conteneur sur les petits écrans.
      maxFontSizeMultiplier={1.4}
      style={[
        base,
        { color: theme.colors[color], textAlign: align },
        tabular && theme.tabularNums,
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

/** Prix formaté — toujours en chiffres tabulaires. */
export function Price({
  variant = 'price',
  ...rest
}: Omit<TextProps, 'tabular'> & { variant?: 'price' | 'priceLarge' | 'priceSmall' }) {
  return <Text variant={variant} tabular {...rest} />;
}
