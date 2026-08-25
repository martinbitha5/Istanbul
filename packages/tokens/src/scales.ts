/** Rythme 4 pt. Toute valeur d'espacement doit venir d'ici. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

/** Marge horizontale standard des écrans mobiles. */
export const screenPadding = spacing.base;

/**
 * Rayons — il n'y en a que deux.
 *
 * Uber n'utilise que 8 px et la pilule. Pas de 12, pas de 16, pas de 24 : une
 * carte fait 8, un bouton rond fait 500. Toute autre valeur trahit
 * immédiatement la copie, et c'est le détail qui fait qu'un écran « ressemble
 * à » sans « être ».
 *
 * L'échelle garde ses anciens noms (`md`, `lg`, `xl`…) et les fait toutes
 * pointer sur 8. Les écrans continuent d'écrire `theme.radius.lg` et prennent
 * le bon rayon sans être réécrits ; le jour où l'un d'eux a vraiment besoin
 * d'autre chose, il faudra ajouter un token et le justifier.
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 8,
  lg: 8,
  xl: 8,
  '2xl': 8,
  pill: 500,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1.5,
  thick: 2,
} as const;

/** Tailles d'icônes tokenisées — jamais de valeur arbitraire. */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
} as const;

/** Plancher de cible tactile (Apple HIG 44 pt / Material 48 dp). */
export const hitTarget = 44;

/** Hauteur des boutons pleine largeur. Uber les fait généreux. */
export const controlHeight = 56;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  overlay: 40,
  modal: 100,
  toast: 1000,
} as const;

/**
 * Élévation.
 *
 * Uber sépare par des filets et des aplats gris, presque jamais par des
 * ombres : `0` et `1` couvrent donc la quasi-totalité des cas. L'ombre de
 * carte réelle est double (`0 0 8px rgba(0,0,0,.1)` + `0 4px 4px
 * rgba(0,0,0,.04)`) ; React Native n'en accepte qu'une, `2` en est
 * l'approximation la plus proche.
 *
 * `3` est réservé à ce qui flotte vraiment au-dessus du contenu : la barre
 * d'onglets en pilules et les feuilles ancrées en bas.
 */
export interface ElevationStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export const elevation: Record<0 | 1 | 2 | 3, ElevationStyle> = {
  0: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  1: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  2: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  3: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
};

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ElevationLevel = keyof typeof elevation;
