export * from './palette';
export * from './theme';
export * from './scales';
export * from './typography';
export * from './motion';

import { colors, type ThemeColors } from './theme';
import {
  borderWidth,
  controlHeight,
  elevation,
  hitTarget,
  iconSize,
  radius,
  screenPadding,
  spacing,
  zIndex,
} from './scales';
import { fontFamily, fontSize, letterSpacing, lineHeight, tabularNums, textStyles } from './typography';
import { duration, easing, pressScale, spring, stagger } from './motion';

/** Objet thème complet consommé par le ThemeProvider de `@istanbul/ui`. */
export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  screenPadding: typeof screenPadding;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  iconSize: typeof iconSize;
  hitTarget: typeof hitTarget;
  controlHeight: typeof controlHeight;
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

/**
 * Le thème, en un seul exemplaire.
 *
 * `createTheme()` ne prend plus de schéma : il n'y en a qu'un. La fonction
 * subsiste parce que le provider l'appelle, et parce qu'un thème construit
 * reste plus facile à étendre qu'une constante figée.
 */
export function createTheme(): Theme {
  return {
    colors,
    spacing,
    screenPadding,
    radius,
    borderWidth,
    iconSize,
    hitTarget,
    controlHeight,
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

export const theme = createTheme();
