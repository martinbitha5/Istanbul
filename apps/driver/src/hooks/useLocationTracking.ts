import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { usePushLocation } from '@istanbul/core';

/**
 * Remontée de position pendant une course.
 *
 * Deux contraintes façonnent ce hook :
 *
 * 1. **Batterie.** Le livreur roule parfois trois heures d'affilée avec un
 *    téléphone d'entrée de gamme. On échantillonne donc à 15 s / 50 m, pas en
 *    continu, et on coupe tout dès que la course est terminée.
 *
 * 2. **Data.** Chaque point coûte une requête. On n'envoie que si le livreur
 *    a réellement bougé — un scooter à l'arrêt devant le restaurant ne doit
 *    pas générer 240 écritures par heure.
 */

const MIN_INTERVAL_MS = 15_000;
const MIN_DISTANCE_M = 50;

export function useLocationTracking(deliveryId: string | null, enabled: boolean) {
  const pushLocation = usePushLocation();
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Empêche l'écran de s'éteindre pendant la course : le livreur consulte
      // l'adresse au feu rouge, il ne doit pas déverrouiller à chaque fois.
      void activateKeepAwakeAsync('delivery');

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: MIN_INTERVAL_MS,
          distanceInterval: MIN_DISTANCE_M,
        },
        (position) => {
          const now = Date.now();
          if (now - lastSentAt.current < MIN_INTERVAL_MS) return;
          lastSentAt.current = now;

          pushLocation.mutate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            deliveryId,
            heading: position.coords.heading ?? null,
            speedKmh: position.coords.speed != null ? position.coords.speed * 3.6 : null,
            accuracyM: position.coords.accuracy ?? null,
          });
        },
      );
    };

    if (enabled && deliveryId) {
      void start();
    }

    return () => {
      cancelled = true;
      subscription.current?.remove();
      subscription.current = null;
      deactivateKeepAwake('delivery');
    };
    // pushLocation est stable (mutation React Query) : l'inclure relancerait
    // l'abonnement à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId, enabled]);
}

/** Position ponctuelle — pour ouvrir un itinéraire ou estimer une distance. */
export async function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
