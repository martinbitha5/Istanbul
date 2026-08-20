import { describe, expect, it } from 'vitest';
import { haversineKm, roadDistanceKm, roughEtaMinutes } from './geo';

describe('géographie — miroir de fn_distance_km', () => {
  // Deux points connus de Kinshasa : le rond-point Victoire et la gare centrale.
  const victoire = { latitude: -4.3369, longitude: 15.3136 };
  const gare = { latitude: -4.3013, longitude: 15.3136 };

  it('donne ~3,96 km entre Victoire et la gare (même longitude)', () => {
    // 0,0356° de latitude × 111,19 km/° ≈ 3,96 km.
    expect(haversineKm(victoire, gare)).toBeCloseTo(3.96, 1);
  });

  it('est symétrique et nulle sur place', () => {
    expect(haversineKm(victoire, gare)).toBe(haversineKm(gare, victoire));
    expect(haversineKm(victoire, victoire)).toBe(0);
  });

  it('applique le facteur de détour urbain ×1.35 comme le SQL', () => {
    const bird = haversineKm(victoire, gare);
    expect(roadDistanceKm(victoire, gare)).toBeCloseTo(Math.round(bird * 1.35 * 100) / 100, 2);
  });

  it('borne l’ETA à au moins une minute', () => {
    expect(roughEtaMinutes(0)).toBe(1);
    expect(roughEtaMinutes(9)).toBe(30); // 9 km à 18 km/h = 30 min
  });
});
