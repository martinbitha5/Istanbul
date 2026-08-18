export * from './palette';
export * from './theme';
export * from './scales';
export * from './typography';
export * from './motion';

import { themes, type ColorSchemeName, type ThemeColors } from './theme';
import { borderWidth, elevation, hitTarget, iconSize, radius, screenPadding, spacing, zIndex } from './scales';
import { fontFamily, fontSize, letterSpacing, lineHeight, tabularNums, textStyles } from './typography';
import { duration, easing, pressScale, spring, stagger } from './motion';

/** Objet thème complet consommé par le ThemeProvider de `@istanbul/ui`. */
export interface Theme {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  screenPadding: typeof screenPadding;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  iconSize: typeof iconSize;
  hitTarget: typeof hitTarget;
  zIndex: typeof zIndex;
  elevation: typeof elevation;
  text: typeof textStyles;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  letterSpacing: typeof letterSpacing;
  tabularNums: typeof tabularNums;
  duration: typeof duration;
  easing: typeof easing;
  spring: typeof spring;
  pressScale: typeof pressScale;
  stagger: typeof stagger;
}

export function createTheme(scheme: ColorSchemeName): Theme {
  return {
    scheme,
    colors: themes[scheme],
    spacing,
    screenPadding,
    radius,
    borderWidth,
    iconSize,
    hitTarget,
    zIndex,
    elevation,
    text: textStyles,
    fontFamily,
    fontSize,
    lineHeight,
    letterSpacing,
    tabularNums,
    duration,
    easing,
    spring,
    pressScale,
    stagger,
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
