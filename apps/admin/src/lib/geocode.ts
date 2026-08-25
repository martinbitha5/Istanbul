/**
 * Géocodage, borné à Kinshasa.
 *
 * Service : Nominatim (OpenStreetMap). Choisi pour la même raison que les
 * tuiles Leaflet du suivi de livraison — aucune clé, aucune facture, aucun
 * quota à négocier pour un établissement indépendant. En contrepartie, sa
 * politique d'usage impose une requête par seconde et un `User-Agent`
 * identifiable ; le navigateur pose le sien, et l'appelant est tenu de
 * n'interroger qu'après une pause de frappe (voir `useDebouncedValue`).
 *
 * Tout est contraint au bbox de la province de Kinshasa (`viewbox` +
 * `bounded=1` + `countrycodes=cd`) : sans cela, « Avenue de la Paix » remonte
 * une rue à Bruxelles avant celle de Lingwala.
 *
 * Le géocodage reste **facultatif**. Une panne du service, un blocage réseau
 * ou un client qui refuse la géolocalisation ne doivent jamais empêcher de
 * commander : l'adresse en texte libre suffit, `fn_delivery_quote` accepte des
 * coordonnées nulles et retombe sur la zone la moins chère.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoResult extends GeoPoint {
  /** Libellé court, tel qu'on l'affiche dans la liste de suggestions. */
  label: string;
  /** Libellé complet renvoyé par Nominatim, pour l'adresse enregistrée. */
  full: string;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org';

/**
 * Emprise de la province de Kinshasa, Maluku et la N'sele comprises.
 * Ordre attendu par Nominatim : ouest, nord, est, sud.
 */
const VIEWBOX = '15.00,-3.90,16.90,-4.95';

/** Centre de la ville — le point de repli quand on n'a rien de mieux. */
export const KINSHASA_CENTER: GeoPoint = { lat: -4.325, lng: 15.322 };

/** Sous ce zoom, la ville entière tient à l'écran. */
export const KINSHASA_ZOOM = 11;

function common(): string {
  return `format=jsonv2&countrycodes=cd&viewbox=${VIEWBOX}&bounded=1&accept-language=fr`;
}

/**
 * Recherche d'adresse. Renvoie une liste vide plutôt que de lever : un service
 * de suggestion indisponible doit se traduire par « aucune suggestion », pas
 * par un écran en erreur.
 */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  try {
    const response = await fetch(
      `${ENDPOINT}/search?${common()}&limit=6&q=${encodeURIComponent(term)}`,
      { signal },
    );
    if (!response.ok) return [];

    const rows = (await response.json()) as Array<{
      lat: string;
      lon: string;
      name?: string;
      display_name: string;
    }>;

    return rows.map((row) => ({
      lat: Number(row.lat),
      lng: Number(row.lon),
      label: shortLabel(row.display_name),
      full: row.display_name,
    }));
  } catch {
    // `AbortError` sur frappe suivante, ou réseau coupé : même réponse.
    return [];
  }
}

/**
 * Adresse d'un point — utilisé quand le client déplace le repère ou se
 * géolocalise. `null` si le service ne répond pas : le repère reste posé, seul
 * le libellé manque, et le client peut l'écrire lui-même.
 */
export async function reverseGeocode(point: GeoPoint, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(
      `${ENDPOINT}/reverse?format=jsonv2&accept-language=fr&zoom=18&lat=${point.lat}&lon=${point.lng}`,
      { signal },
    );
    if (!response.ok) return null;

    const row = (await response.json()) as { display_name?: string };
    return row.display_name ? shortLabel(row.display_name) : null;
  } catch {
    return null;
  }
}

/**
 * « Avenue Delvaux, Ngaliema, Kinshasa, 12345, République démocratique du
 * Congo » n'entre pas dans un champ de 40 caractères et ne dit rien de plus
 * que ses trois premiers segments. On garde ceux-là, puis on rajoute
 * « Kinshasa » s'il a sauté — c'est le repère que le livreur lit en premier.
 */
function shortLabel(displayName: string): string {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^\d{4,}$/.test(part))
    .filter((part) => !/^(r[ée]publique|congo)/i.test(part));

  const head = parts.slice(0, 3);
  if (!head.some((part) => /kinshasa/i.test(part))) head.push('Kinshasa');
  return head.join(', ');
}

/**
 * Distance à vol d'oiseau, en kilomètres (formule de haversine).
 *
 * Sert à situer une adresse par rapport au restaurant et aux anneaux de
 * livraison affichés sur la carte. Le tarif définitif, lui, reste calculé par
 * `fn_delivery_quote` côté serveur — un prix décidé dans le navigateur serait
 * un prix négociable.
 */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
