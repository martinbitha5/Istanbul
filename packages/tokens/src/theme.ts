import { amber, blue, green, ink, red } from './palette';

/**
 * Tokens sémantiques.
 *
 * Un seul thème, clair, et c'est délibéré : Uber Eats n'a pas de mode sombre,
 * et la vitrine web force déjà `color-scheme: light`. Inventer un sombre que
 * la référence n'a pas, c'était s'engager à le maintenir écran par écran sans
 * jamais pouvoir vérifier qu'il est juste.
 *
 * Les noms restent ceux de l'ancien système (`primary`, `accent`, `success`…)
 * pour que les écrans n'aient pas à changer d'un bloc : ce qui change, c'est
 * la valeur derrière le nom. `primary` ne veut plus dire « braise » mais
 * « la couleur d'action », et cette couleur est noire.
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
  /** Texte posé sur `scrim`/`overlay` (voile sombre sur photo). */
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

export const colors: ThemeColors = {
  // Fond blanc franc, pas cassé : Uber ne pose jamais de gris derrière le
  // contenu. Les zones grises sont des éléments (champs, puces), pas le décor.
  background: ink[0],
  surface: ink[0],
  surfaceRaised: ink[0],
  surfaceSunken: ink[50],
  surfaceInverse: ink[950],
  scrim: 'rgba(0, 0, 0, 0.55)',

  text: ink[950],
  textSecondary: ink[600],
  textMuted: ink[500],
  textInverse: ink[0],
  textOnPrimary: ink[0],
  textOnScrim: ink[0],

  // Le noir EST la couleur d'action. C'est la rupture principale avec
  // l'ancienne palette braise, et ce qui fait immédiatement « Uber » à l'œil.
  primary: ink[950],
  primaryPressed: ink[700],
  primarySoft: ink[50],
  onPrimarySoft: ink[950],

  // Le vert de marque sert de remplissage et de pastille, jamais de bouton.
  // Le texte posé dessus est encre : blanc sur #06C167 ne donne que 2.3:1,
  // alors que le splash d'Uber lui-même écrit son mot-logo en noir sur vert.
  accent: green[500],
  accentSoft: green[50],
  onAccentSoft: green[700],
  textOnAccent: ink[950],

  // `success` est le vert assombri : c'est lui qui porte du texte blanc
  // (badges « 1 acheté = 1 offert ») et c'est lui qu'on écrit sur du blanc.
  success: green[600],
  successSoft: green[50],
  onSuccessSoft: green[700],
  warning: amber[500],
  warningSoft: amber[50],
  onWarningSoft: amber[700],
  danger: red[500],
  dangerSoft: red[50],
  onDangerSoft: red[600],
  info: blue[500],
  infoSoft: blue[50],
  onInfoSoft: blue[600],

  border: ink[200],
  borderStrong: ink[300],
  divider: ink[150],
  skeleton: ink[50],
  skeletonHighlight: ink[100],

  disabled: ink[50],
  disabledText: ink[400],
  overlay: 'rgba(0, 0, 0, 0.45)',
  shadow: '#000000',
  focusRing: blue[500],
};
