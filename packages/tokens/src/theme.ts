import { bosphorus, danger, ember, ink, pistachio, saffron } from './palette';

/**
 * Tokens sémantiques.
 *
 * Chaque thème définit la valeur COMPLÈTE de chaque token — rien n'est calculé
 * à la volée ni hérité. Le mode sombre n'est pas une inversion : la braise
 * remonte à 400 pour tenir 4.5:1 sur fond encre 950.
 */
export interface ThemeColors {
  // Surfaces
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  surfaceInverse: string;
  scrim: string;

  // Texte
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnPrimary: string;
  /** Texte posé sur `scrim`/`overlay` (voile sombre sur photo) — clair dans les deux thèmes. */
  textOnScrim: string;

  // Marque
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimarySoft: string;

  // Accent
  accent: string;
  accentSoft: string;
  onAccentSoft: string;
  textOnAccent: string;

  // Sémantiques
  success: string;
  successSoft: string;
  onSuccessSoft: string;
  warning: string;
  warningSoft: string;
  onWarningSoft: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;
  info: string;
  infoSoft: string;
  onInfoSoft: string;

  // Structure
  border: string;
  borderStrong: string;
  divider: string;
  skeleton: string;
  skeletonHighlight: string;

  // États
  disabled: string;
  disabledText: string;
  overlay: string;
  shadow: string;
  /** Anneau de focus clavier — doit rester visible sur `primary` comme sur `surface`. */
  focusRing: string;
}

export const lightColors: ThemeColors = {
  background: ink[25],
  surface: ink[0],
  surfaceRaised: ink[0],
  surfaceSunken: ink[50],
  surfaceInverse: ink[900],
  scrim: 'rgba(26, 22, 19, 0.55)',

  text: ink[900],
  textSecondary: ink[600],
  textMuted: ink[500],
  textInverse: ink[0],
  textOnPrimary: '#FFFFFF',
  textOnScrim: '#FFFFFF',

  // 500 ne tient que 4.08:1 sous du blanc : les CTA passent au 600 (5.5:1).
  primary: ember[600],
  primaryPressed: ember[700],
  primarySoft: ember[50],
  onPrimarySoft: ember[700],

  accent: saffron[400],
  accentSoft: saffron[100],
  onAccentSoft: saffron[700],
  textOnAccent: ink[900],

  // Les `on*Soft` garantissent 4.5:1 sur leur fond doux — jamais le ton de base.
  success: pistachio[600],
  successSoft: pistachio[100],
  onSuccessSoft: pistachio[700],
  warning: saffron[600],
  warningSoft: saffron[100],
  onWarningSoft: saffron[700],
  danger: danger[500],
  dangerSoft: danger[100],
  onDangerSoft: danger[600],
  info: bosphorus[600],
  infoSoft: bosphorus[100],
  onInfoSoft: bosphorus[600],

  border: ink[200],
  borderStrong: ink[300],
  divider: ink[100],
  skeleton: ink[100],
  skeletonHighlight: ink[50],

  disabled: ink[100],
  disabledText: ink[400],
  overlay: 'rgba(26, 22, 19, 0.45)',
  shadow: '#3A1E12',
  focusRing: bosphorus[500],
};

export const darkColors: ThemeColors = {
  background: ink[950],
  surface: ink[900],
  surfaceRaised: ink[800],
  surfaceSunken: '#0A0807',
  surfaceInverse: ink[50],
  scrim: 'rgba(0, 0, 0, 0.65)',

  text: '#F7F1EB',
  textSecondary: ink[300],
  textMuted: ink[400],
  textInverse: ink[900],
  // Blanc sur ember 400 = 2.9:1 : en sombre, les CTA portent du texte encre.
  textOnPrimary: ink[950],
  // Le voile photo reste sombre quel que soit le thème : le texte reste clair.
  textOnScrim: '#FFFFFF',

  // 500 ne passe pas 4.5:1 sur ink[950] : on remonte d'un cran.
  primary: ember[400],
  primaryPressed: ember[300],
  primarySoft: 'rgba(247, 107, 69, 0.16)',
  onPrimarySoft: ember[300],

  accent: saffron[300],
  accentSoft: 'rgba(244, 201, 93, 0.16)',
  onAccentSoft: saffron[200],
  textOnAccent: ink[950],

  success: pistachio[300],
  successSoft: 'rgba(142, 212, 158, 0.16)',
  onSuccessSoft: pistachio[300],
  warning: saffron[300],
  warningSoft: 'rgba(244, 201, 93, 0.16)',
  onWarningSoft: saffron[300],
  danger: danger[300],
  dangerSoft: 'rgba(238, 154, 154, 0.16)',
  onDangerSoft: danger[300],
  info: bosphorus[300],
  infoSoft: 'rgba(121, 200, 222, 0.16)',
  onInfoSoft: bosphorus[300],

  border: '#332C27',
  borderStrong: '#4A413A',
  divider: '#241F1B',
  skeleton: '#241F1B',
  skeletonHighlight: '#332C27',

  disabled: '#241F1B',
  disabledText: ink[500],
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  focusRing: bosphorus[300],
};

export type ColorSchemeName = 'light' | 'dark';

export const themes: Record<ColorSchemeName, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
