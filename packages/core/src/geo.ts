/**
 * Géographie côté client — miroir de `fn_distance_km` / `fn_road_distance_km`.
 * Sert à l'affichage (« votre livreur est à ~1,2 km ») ; le serveur reste
 * l'autorité pour tout ce qui est tarifé.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;

  return Math.round(EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/** Distance routière approchée : vol d'oiseau × 1.35, comme en SQL. */
export function roadDistanceKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * 1.35 * 100) / 100;
}

/** ETA grossier en minutes pour un scooter en ville (~18 km/h de moyenne). */
export function roughEtaMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 18) * 60));
}
