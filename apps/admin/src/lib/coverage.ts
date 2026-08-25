/**
 * Zone desservie.
 *
 * Istanbul Fast Food ne livre qu'à Kinshasa, et y livre *partout* : la
 * couverture est donc la ville entière, pas le rayon des `delivery_zones`.
 * Ces zones continuent de porter le tarif et le délai (0–3 km, 3–6 km,
 * 6–10 km) ; ce module ne répond qu'à une question, en amont : « cette
 * adresse est-elle à Kinshasa ? ».
 *
 * Reconnaissance textuelle, volontairement.
 *
 * Un vrai géocodage (Google Places, Mapbox, Nominatim) donnerait des
 * coordonnées et une réponse exacte — mais il demande une clé, un budget et
 * un quota, et il tombe en panne hors-ligne. Ici on lit ce que le client a
 * écrit et on cherche Kinshasa ou l'une de ses 24 communes. C'est suffisant
 * pour l'aiguillage « on livre / on ne livre pas encore », et la position
 * précise est de toute façon confirmée plus tard par `fn_delivery_quote`, qui
 * travaille sur latitude/longitude.
 *
 * Le jour où le géocodage arrive, seul `isInCoverage` change de corps.
 */

export const COVERAGE_CITY = 'Kinshasa';

/**
 * Kinshasa et ses 24 communes, plus les graphies courantes.
 *
 * Tout est écrit sous forme normalisée (minuscules, sans accent ni
 * apostrophe) : c'est la forme que produit `normalize` ci-dessous.
 */
const COVERED_PLACES = [
  'kinshasa',
  'kin',
  'bandalungwa',
  'bandal',
  'barumbu',
  'bumbu',
  'gombe',
  'kalamu',
  'kasa vubu',
  'kasavubu',
  'kimbanseke',
  'kintambo',
  'kisenso',
  'lemba',
  'limete',
  'lingwala',
  'makala',
  'maluku',
  'masina',
  'matete',
  'mont ngafula',
  'ngafula',
  'ndjili',
  'ngaba',
  'ngaliema',
  'ngiri ngiri',
  'nsele',
  'selembao',
];

/**
 * Minuscules, sans accent, sans apostrophe, ponctuation ramenée à des
 * espaces. « N'Djili » et « Ndjili », « Mont-Ngafula » et « mont ngafula »
 * doivent donner la même chaîne.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    // Diacritiques Unicode : é → e, ï → i. Plage écrite en échappements —
    // des marques combinantes collées dans le source sont invisibles à la
    // relecture et un éditeur peut les normaliser à l'enregistrement.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * `true` si l'adresse mentionne Kinshasa ou l'une de ses communes.
 *
 * Comparaison sur mots entiers : une rue « Kintambo » compte, mais un
 * « Makalamba » quelconque ne doit pas passer pour Makala.
 */
export function isInCoverage(address: string | null | undefined): boolean {
  if (!address) return false;

  const haystack = ` ${normalize(address)} `;
  return COVERED_PLACES.some((place) => haystack.includes(` ${place} `));
}

/**
 * Emprise de la province de Kinshasa : Maluku au nord-est, Mont-Ngafula au
 * sud, le fleuve à l'ouest. Bornes larges à dessein — mieux vaut accepter une
 * commande à la limite et la trancher au moment du devis que refuser une
 * adresse réelle sur un arrondi.
 */
const BOUNDS = { north: -3.85, south: -5.0, west: 15.0, east: 16.95 };

/**
 * Couverture décidée sur les coordonnées, quand le client a posé un repère
 * sur la carte.
 *
 * C'est la réponse la plus fiable dont on dispose : elle ne dépend ni de
 * l'orthographe, ni du fait que le client ait pensé à écrire « Kinshasa » à la
 * fin de sa ligne. Le repli textuel (`isInCoverage`) reste en place pour tous
 * ceux qui tapent leur adresse sans jamais toucher la carte.
 */
export function isPointInCoverage(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return lat <= BOUNDS.north && lat >= BOUNDS.south && lng >= BOUNDS.west && lng <= BOUNDS.east;
}

/**
 * La réponse retenue par la vitrine : les coordonnées font foi si elles
 * existent, le texte sinon.
 */
export function isDeliverable(prefs: {
  address: string | null;
  lat: number | null;
  lng: number | null;
}): boolean {
  if (prefs.lat !== null && prefs.lng !== null) return isPointInCoverage(prefs.lat, prefs.lng);
  return isInCoverage(prefs.address);
}

/**
 * La liste des communes destinée à l'aide à la saisie a déménagé dans
 * `lib/kinshasa.ts` : elle y porte aussi les coordonnées de chaque commune,
 * dont la carte a besoin. Ce module ne garde que la question de couverture.
 */
