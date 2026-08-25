import { describe, expect, it } from 'vitest';
import { colors, type ThemeColors } from './theme';

/**
 * Contrastes WCAG mécanisés.
 *
 * Le design system promet « contraste ≥ 4.5:1 ». Cette promesse a déjà été
 * violée une fois sans que personne ne s'en aperçoive — badges à 3.2:1, CTA à
 * 4.08:1. Ce test la rend incassable : toute paire contractuelle qui descend
 * sous le seuil fait échouer la CI.
 *
 * Le passage au thème Uber n'a pas relâché ce filet, et c'est ce qui a dicté
 * deux écarts assumés avec la référence :
 *
 *   - le texte posé sur le vert de marque est encre, pas blanc (blanc sur
 *     #06C167 = 2.3:1 chez Uber) ;
 *   - les badges pleins verts prennent #048A4A et non #06C167, ce qui rend
 *     leur texte blanc lisible sans changer le vert perçu.
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
    // Badges pleins : le texte y est blanc, et c'est la paire qui a dicté le
    // choix d'un vert assombri plutôt que le #06C167 de marque.
    ['textInverse / success (badge plein)', colors.textInverse, colors.success, 4.5],
    ['textInverse / danger (badge plein)', colors.textInverse, colors.danger, 4.5],
    ['success / surface (texte vert)', colors.success, colors.surface, 4.5],
  ];
}

describe('Thème', () => {
  it.each(contractualPairs(colors))('%s ≥ %f:1', (_label, fg, bg, threshold) => {
    // Les fonds doux translucides se composent sur la surface du thème.
    const ratio = contrast(fg, bg, colors.surface);
    expect(ratio).toBeGreaterThanOrEqual(threshold);
  });
});
