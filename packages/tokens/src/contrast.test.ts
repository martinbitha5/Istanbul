import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, type ThemeColors } from './theme';

/**
 * Contrastes WCAG mécanisés.
 *
 * Le design system promet « contraste ≥ 4.5:1, vérifié dans les deux thèmes »
 * (DESIGN-SYSTEM.md §10). Cette promesse a déjà été violée une fois sans que
 * personne ne s'en aperçoive — badges à 3.2:1, CTA à 4.08:1. Ce test la rend
 * incassable : toute paire contractuelle qui descend sous le seuil fait
 * échouer la CI.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
  if (!match) throw new Error(`Couleur non analysable : ${color}`);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

type Rgb = { r: number; g: number; b: number };

/** Compose une couleur (potentiellement translucide) sur un fond opaque. */
function blend(foreground: { r: number; g: number; b: number; a: number }, background: Rgb): Rgb {
  return {
    r: foreground.a * foreground.r + (1 - foreground.a) * background.r,
    g: foreground.a * foreground.g + (1 - foreground.a) * background.g,
    b: foreground.a * foreground.b + (1 - foreground.a) * background.b,
  };
}

function luminance(rgb: Rgb): number {
  return (
    0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b)
  );
}

/** Ratio de contraste WCAG. `surface` sert à composer les fonds translucides. */
function contrast(foreground: string, background: string, surface: string): number {
  const surfaceRgb = parseColor(surface);
  const bg = blend(parseColor(background), surfaceRgb);
  const fg = blend(parseColor(foreground), bg);
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Paires contractuelles : (premier plan, fond, seuil). */
function contractualPairs(colors: ThemeColors): [string, string, string, number][] {
  return [
    ['textOnPrimary / primary (CTA)', colors.textOnPrimary, colors.primary, 4.5],
    ['textOnAccent / accent', colors.textOnAccent, colors.accent, 4.5],
    ['text / background', colors.text, colors.background, 7],
    ['text / surface', colors.text, colors.surface, 7],
    ['textSecondary / surface', colors.textSecondary, colors.surface, 4.5],
    ['primary / surface (bouton ghost)', colors.primary, colors.surface, 4.5],
    ['onSuccessSoft / successSoft', colors.onSuccessSoft, colors.successSoft, 4.5],
    ['onWarningSoft / warningSoft', colors.onWarningSoft, colors.warningSoft, 4.5],
    ['onDangerSoft / dangerSoft', colors.onDangerSoft, colors.dangerSoft, 4.5],
    ['onInfoSoft / infoSoft', colors.onInfoSoft, colors.infoSoft, 4.5],
    ['onPrimarySoft / primarySoft', colors.onPrimarySoft, colors.primarySoft, 4.5],
    ['textInverse / surfaceInverse', colors.textInverse, colors.surfaceInverse, 4.5],
  ];
}

describe.each([
  ['clair', lightColors],
  ['sombre', darkColors],
] as const)('Thème %s', (_name, colors) => {
  it.each(contractualPairs(colors))('%s ≥ %f:1', (_label, fg, bg, threshold) => {
    // Les fonds doux translucides se composent sur la surface la plus claire
    // du thème (le pire cas pour le contraste).
    const ratio = contrast(fg, bg, colors.surface);
    expect(ratio).toBeGreaterThanOrEqual(threshold);
  });
});
