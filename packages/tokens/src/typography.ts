/**
 * Typographie.
 *
 * Trois familles, trois rôles distincts :
 *   Brand   — Playfair Display SC : logo, splash, titres éditoriaux. Rien d'autre.
 *   Heading — Sora : titres d'écran, noms de produits, prix.
 *   Body    — Inter : descriptions, labels, formulaires.
 */
export const fontFamily = {
  brand: 'PlayfairDisplaySC_700Bold',
  brandRegular: 'PlayfairDisplaySC_400Regular',

  headingBold: 'Sora_700Bold',
  headingSemi: 'Sora_600SemiBold',
  heading: 'Sora_500Medium',

  bodyBold: 'Inter_700Bold',
  bodySemi: 'Inter_600SemiBold',
  bodyMedium: 'Inter_500Medium',
  body: 'Inter_400Regular',
} as const;

export const fontSize = {
  xxs: 11,
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
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
 * Rôles de texte. Un écran compose ces rôles, il ne redéfinit jamais
 * fontSize/fontFamily à la main.
 */
export const textStyles = {
  /** Wordmark « Istanbul » — splash et en-tête de marque uniquement. */
  brand: style(fontFamily.brand, fontSize['3xl'], lineHeight.tight, letterSpacing.tight),
  brandSmall: style(fontFamily.brand, fontSize.lg, lineHeight.tight, letterSpacing.normal),

  display: style(fontFamily.headingBold, fontSize['2xl'], lineHeight.tight, letterSpacing.tight),
  h1: style(fontFamily.headingBold, fontSize.xl, lineHeight.tight, letterSpacing.tight),
  h2: style(fontFamily.headingSemi, fontSize.lg, lineHeight.snug),
  h3: style(fontFamily.headingSemi, fontSize.md, lineHeight.snug),

  body: style(fontFamily.body, fontSize.base, lineHeight.normal),
  bodyStrong: style(fontFamily.bodySemi, fontSize.base, lineHeight.normal),
  bodySmall: style(fontFamily.body, fontSize.sm, lineHeight.normal),

  label: style(fontFamily.bodyMedium, fontSize.sm, lineHeight.snug),
  labelStrong: style(fontFamily.bodySemi, fontSize.sm, lineHeight.snug),
  caption: style(fontFamily.body, fontSize.xs, lineHeight.snug),

  /** Puces, badges, statuts. Majuscules imposées côté composant. */
  overline: style(fontFamily.bodySemi, fontSize.xxs, lineHeight.snug, letterSpacing.wider),

  /** Prix — Sora + chiffres tabulaires côté composant. */
  price: style(fontFamily.headingBold, fontSize.md, lineHeight.snug, letterSpacing.tight),
  priceLarge: style(fontFamily.headingBold, fontSize.xl, lineHeight.tight, letterSpacing.tight),
  priceSmall: style(fontFamily.headingSemi, fontSize.base, lineHeight.snug),

  button: style(fontFamily.bodySemi, fontSize.md, lineHeight.snug),
  buttonSmall: style(fontFamily.bodySemi, fontSize.base, lineHeight.snug),
} as const;

/** À appliquer sur tout texte numérique susceptible de changer en place. */
export const tabularNums = { fontVariant: ['tabular-nums'] as const };

export type TextStyleToken = keyof typeof textStyles;
