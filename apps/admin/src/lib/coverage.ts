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
 * Les communes, pour l'aide à la saisie.
 *
 * Sans autocomplétion géographique, la liste rend le champ honnête : le
 * client voit ce qu'on attend de lui au lieu de deviner pourquoi son adresse
 * est refusée.
 */
export const KINSHASA_COMMUNES = [
  'Bandalungwa',
  'Barumbu',
  'Bumbu',
  'Gombe',
  'Kalamu',
  'Kasa-Vubu',
  'Kimbanseke',
  'Kinshasa',
  'Kintambo',
  'Kisenso',
  'Lemba',
  'Limete',
  'Lingwala',
  'Makala',
  'Maluku',
  'Masina',
  'Matete',
  'Mont-Ngafula',
  'N’Djili',
  'Ngaba',
  'Ngaliema',
  'Ngiri-Ngiri',
  'Nsele',
  'Selembao',
] as const;
