/**
 * Typographie.
 *
 * Deux familles, deux rôles — c'est la structure d'Uber, qui oppose UberMove
 * (titres) à UberMoveText (courant) :
 *
 *   Display — Figtree : titres d'écran, noms d'établissement, prix, boutons.
 *   Body    — Inter   : descriptions, méta, formulaires.
 *
 * UberMove est propriétaire et non redistribuable. Figtree est la grotesque
 * géométrique la plus proche — mêmes proportions en gras, même rondeur — et
 * c'est déjà elle qui tient ce rôle sur la vitrine web. Inter, de son côté,
 * est presque indiscernable d'UberMoveText.
 *
 * Playfair Display a disparu : le sérif éditorial n'existe nulle part chez
 * Uber, et le garder pour le seul mot-logo aurait laissé une police entière
 * dans le bundle pour trois écrans.
 */
export const fontFamily = {
  /** Mot-logo « Istanbul » — le poids le plus lourd, comme « Uber Eats ». */
  brand: 'Figtree_800ExtraBold',
  brandRegular: 'Figtree_600SemiBold',

  headingBold: 'Figtree_700Bold',
  headingSemi: 'Figtree_600SemiBold',
  heading: 'Figtree_500Medium',

  bodyBold: 'Inter_700Bold',
  bodySemi: 'Inter_600SemiBold',
  bodyMedium: 'Inter_500Medium',
  body: 'Inter_400Regular',
} as const;

export const fontSize = {
  xxs: 11,
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 40,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const letterSpacing = {
  tighter: -0.6,
  tight: -0.3,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;

type TextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

const style = (
  family: string,
  size: number,
  lh: number,
  ls: number = letterSpacing.normal,
): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight: Math.round(size * lh),
  letterSpacing: ls,
});

/**
 * Resserrement des gros titres.
 *
 * UberMove est plus étroite que Figtree. À -0.02 em, l'écart se rattrape là
 * où il se voit — sur les titres de 24 px et plus. En dessous, le
 * resserrement se lit comme un défaut de rendu, donc on n'y touche pas.
 */
const tighten = (size: number) => Math.round(size * -0.02 * 10) / 10;

/**
 * Rôles de texte. Un écran compose ces rôles, il ne redéfinit jamais
 * fontSize/fontFamily à la main.
 */
export const textStyles = {
  /** Mot-logo — splash et en-tête de marque uniquement. */
  brand: style(fontFamily.brand, fontSize['3xl'], 1.2, tighten(fontSize['3xl'])),
  brandSmall: style(fontFamily.brand, fontSize.lg, 1.2, tighten(fontSize.lg)),

  /** Titre de héros — écran d'accueil auth, onboarding. */
  display: style(fontFamily.headingBold, fontSize['3xl'], 1.2, tighten(fontSize['3xl'])),
  /** Titre d'écran, aligné à gauche et volontairement gros (« Paniers »). */
  h1: style(fontFamily.headingBold, fontSize['2xl'], 1.29, tighten(fontSize['2xl'])),
  /** Titre de section (« Articles en vedette »). */
  h2: style(fontFamily.headingBold, fontSize.xl, 1.33, tighten(fontSize.xl)),
  /** Nom de produit, titre de carte. */
  h3: style(fontFamily.headingSemi, fontSize.md, 1.33),

  body: style(fontFamily.body, fontSize.base, 1.5),
  bodyStrong: style(fontFamily.bodySemi, fontSize.base, 1.5),
  bodySmall: style(fontFamily.body, fontSize.sm, 1.43),

  label: style(fontFamily.bodyMedium, fontSize.sm, 1.43),
  labelStrong: style(fontFamily.bodySemi, fontSize.sm, 1.43),
  caption: style(fontFamily.body, fontSize.xs, 1.33),

  /**
   * Puces et badges.
   *
   * Uber n'écrit pas ses badges en majuscules espacées : « 1 acheté = 1
   * offert » se lit en casse normale. Le token garde son nom, mais l'espacement
   * revient à zéro et les composants n'imposent plus `textTransform`.
   */
  overline: style(fontFamily.bodySemi, fontSize.xs, 1.33),

  /** Prix — Figtree + chiffres tabulaires côté composant. */
  price: style(fontFamily.headingBold, fontSize.base, 1.5),
  priceLarge: style(fontFamily.headingBold, fontSize.xl, 1.33, tighten(fontSize.xl)),
  priceSmall: style(fontFamily.headingSemi, fontSize.sm, 1.43),

  button: style(fontFamily.headingSemi, fontSize.base, 1.5),
  buttonSmall: style(fontFamily.headingSemi, fontSize.sm, 1.43),
} as const;

/** À appliquer sur tout texte numérique susceptible de changer en place. */
// Pas de `as const` : react-native attend un FontVariant[] mutable.
export const tabularNums: { fontVariant: 'tabular-nums'[] } = {
  fontVariant: ['tabular-nums'],
};

export type TextStyleToken = keyof typeof textStyles;
