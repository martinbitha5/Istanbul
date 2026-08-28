/**
 * `@istanbul/map` — la carte, une seule fois, pour les trois applications.
 *
 * Le package ne dépend de rien : ni React, ni React Native, ni Supabase. Il ne
 * produit qu'une chaîne HTML. C'est ce qui lui permet d'être consommé aussi
 * bien par `@istanbul/ui` (WebView) que par le dashboard Next.js (iframe) sans
 * traîner l'un dans l'autre.
 */

export * from './types';
export * from './token';
export { MAPBOX_STYLE } from './mapbox';

import { buildLeafletHtml } from './leaflet';
import { buildMapboxHtml } from './mapbox';
import { getMapboxToken } from './token';
import type { MapColors, MapHtmlOptions } from './types';

/**
 * Palette de la carte.
 *
 * Reprise de `@istanbul/tokens` mais recopiée ici en valeurs brutes : le
 * package doit rester sans dépendance, et ces trois couleurs sont figées par
 * la charte (le noir d'encre et le vert de marque d'Uber Eats). Les appelants
 * peuvent toujours passer les leurs.
 */
export const DEFAULT_MAP_COLORS: MapColors = {
  route: '#0A0A0A',
  trail: '#06C167',
  background: '#EDEDED',
};

export type BuildMapHtmlOptions = Omit<MapHtmlOptions, 'token' | 'colors'> & {
  /** Par défaut : le jeton enregistré via `setMapboxToken`. */
  token?: string;
  colors?: Partial<MapColors>;
};

/**
 * Construit la page de carte : Mapbox si un jeton public est disponible,
 * OpenStreetMap sinon. L'appelant n'a pas à savoir laquelle il obtient.
 */
export function buildMapHtml(options: BuildMapHtmlOptions): string {
  const token = (options.token ?? getMapboxToken()).trim();
  const resolved: MapHtmlOptions = {
    ...options,
    token,
    colors: { ...DEFAULT_MAP_COLORS, ...options.colors },
  };

  return token.startsWith('pk.') ? buildMapboxHtml(resolved) : buildLeafletHtml(resolved);
}
