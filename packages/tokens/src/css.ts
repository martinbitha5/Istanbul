import { darkColors, lightColors, type ThemeColors } from './theme';
import { radius, spacing } from './scales';

/**
 * Pont vers le dashboard Next.js : les mêmes tokens, exposés en variables CSS.
 *
 * Le dashboard et les apps mobiles partagent donc littéralement la même
 * palette — impossible qu'elles dérivent l'une de l'autre.
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
 * Feuille de style à injecter dans `globals.css` du dashboard.
 * Le thème sombre est défini pour `[data-theme="dark"]` ET pour la préférence
 * système, sans que l'un n'écrase l'autre par accident.
 */
export function buildCssVariables(): string {
  return [
    ':root {',
    colorVars(lightColors),
    scaleVars(),
    '}',
    '',
    ':root[data-theme="dark"] {',
    colorVars(darkColors),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) {',
    colorVars(darkColors)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n'),
    '  }',
    '}',
    '',
  ].join('\n');
}
