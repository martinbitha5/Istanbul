/**
 * Jeton public Mapbox.
 *
 * Même convention que `setSupabaseClient` : le package ne lit jamais
 * `process.env`. Chaque application résout sa propre variable
 * (`EXPO_PUBLIC_MAPBOX_TOKEN` côté Expo, `NEXT_PUBLIC_MAPBOX_TOKEN` côté
 * Next.js) et l'enregistre ici au démarrage. Metro et Next remplacent ces
 * littéraux à la compilation : une lecture dynamique depuis un package
 * partagé ne serait pas substituée et retournerait `undefined`.
 *
 * Un `pk.` est public par construction — il finit dans le bundle et dans le
 * HTML de la carte, c'est son usage prévu. Pour le restreindre depuis
 * account.mapbox.com, sachez quelles origines l'utilisent :
 *   - le dashboard  → le domaine Vercel du back-office ;
 *   - les WebViews mobiles → `https://istanbul.local` (baseUrl fixée par
 *     `TrackingMap`, voir le commentaire du composant).
 * Une restriction qui oublie la seconde rend la carte blanche sur téléphone.
 */

let token = '';

export function setMapboxToken(value: string | undefined | null): void {
  token = (value ?? '').trim();
}

export function getMapboxToken(): string {
  return token;
}

/**
 * Vrai quand un jeton exploitable est configuré.
 *
 * Sans jeton la carte ne casse pas : elle retombe sur les tuiles
 * OpenStreetMap et le routage OSRM, sans clé ni facture. C'était le choix
 * d'origine du projet, il reste le filet.
 */
export function hasMapbox(): boolean {
  return token.startsWith('pk.');
}
