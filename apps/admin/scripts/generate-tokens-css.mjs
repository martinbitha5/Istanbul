/**
 * Génère src/styles/tokens.css à partir de @istanbul/tokens.
 *
 * Le dashboard et les apps mobiles partagent ainsi littéralement la même
 * palette : impossible qu'elles dérivent l'une de l'autre au fil des mois.
 *
 *   pnpm --filter @istanbul/admin tokens:css
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokensEntry = resolve(here, '../../../packages/tokens/src/css.ts');
const output = resolve(here, '../src/styles/tokens.css');

// Node ne sait pas charger du TypeScript directement : on passe par tsx/jiti
// si disponible, sinon on demande à l'utilisateur de lancer via `tsx`.
let buildCssVariables;
try {
  ({ buildCssVariables } = await import(pathToFileURL(tokensEntry).href));
} catch {
  console.error(
    'Impossible de charger les tokens TypeScript.\n' +
      'Lancez : pnpm dlx tsx apps/admin/scripts/generate-tokens-css.mjs',
  );
  process.exit(1);
}

const css = `/* Généré par scripts/generate-tokens-css.mjs — ne pas modifier à la main. */\n\n${buildCssVariables()}`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, css, 'utf8');

console.log(`✓ ${output}`);
