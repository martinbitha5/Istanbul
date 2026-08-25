import { colors, type ThemeColors } from './theme';
import { radius, spacing } from './scales';

/**
 * Pont vers le web : les mêmes tokens, exposés en variables CSS.
 *
 * ⚠️ Le dashboard `/admin` ne consomme PLUS cette sortie : il vit sur sa
 * propre palette Wise, écrite à la main dans `globals.css`. Ne relancez pas
 * `pnpm tokens:css` en croyant rafraîchir le dashboard — vous écraseriez son
 * thème. La vitrine publique, elle, porte les mêmes valeurs qu'ici mais les
 * déclare dans `store.css`, parce qu'elle a aussi besoin de tokens (hauteur
 * d'en-tête, gouttière) qui n'ont pas de sens sur mobile.
 *
 * Cette fonction reste donc le point de vérité si l'on rebranche un jour une
 * surface web sur les tokens mobiles.
 */

const kebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function colorVars(colors: ThemeColors): string {
  return (Object.keys(colors) as (keyof ThemeColors)[])
    .map((key) => `  --color-${kebab(key)}: ${colors[key]};`)
    .join('\n');
}

function scaleVars(): string {
  const space = Object.entries(spacing)
    .map(([key, value]) => `  --space-${key}: ${value}px;`)
    .join('\n');
  const rad = Object.entries(radius)
    .map(([key, value]) => `  --radius-${key}: ${value}px;`)
    .join('\n');
  return `${space}\n${rad}`;
}

/**
 * Feuille de style à injecter dans une surface web.
 *
 * Plus aucun bloc sombre : le système n'a qu'un thème. `color-scheme: light`
 * est déclaré explicitement, sans quoi un visiteur en préférence sombre
 * récupère des champs de formulaire et des ascenseurs noirs sur fond blanc.
 */
export function buildCssVariables(): string {
  return [':root {', '  color-scheme: light;', colorVars(colors), scaleVars(), '}', ''].join('\n');
}
