import { formatMoney } from '@istanbul/core';
import type { DeliveryZone } from '@istanbul/types';
import type { DeliveryRing } from '@/components/store/KinshasaMap';

/**
 * Traduction des zones de livraison en anneaux dessinables.
 *
 * `delivery_zones` porte des bornes (0–3 km, 3–6 km, 6–10 km) ; une carte, elle,
 * ne trace que des disques centrés sur le restaurant. On garde donc la borne
 * extérieure de chaque zone : l'empilement des disques, du plus grand au plus
 * petit, reconstitue les couronnes à l'écran.
 *
 * Le libellé passe tel quel dans l'infobulle — c'est la seule endroit de la
 * vitrine où le client voit le barème complet avant de commander.
 */
export function deliveryRings(zones: DeliveryZone[], currency: string): DeliveryRing[] {
  return zones
    .filter((zone) => Number(zone.max_distance_km) > 0)
    .map((zone) => ({
      km: Number(zone.max_distance_km),
      label: `${zone.name} · ${
        zone.fee_amount === 0 ? 'livraison offerte' : formatMoney(zone.fee_amount, currency)
      } · ${zone.eta_minutes} min`,
    }))
    .sort((a, b) => a.km - b.km);
}

/**
 * La zone qui couvre cette distance, ou `null` au-delà de la plus lointaine.
 *
 * Indicatif uniquement : le tarif qui fait foi est celui que renvoie
 * `fn_delivery_quote` au moment de la commande. Un prix arrêté dans le
 * navigateur serait un prix négociable.
 */
export function zoneForDistance(zones: DeliveryZone[], km: number): DeliveryZone | null {
  return (
    zones.find(
      (zone) => km >= Number(zone.min_distance_km) && km <= Number(zone.max_distance_km),
    ) ?? null
  );
}
