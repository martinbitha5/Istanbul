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

/**
 * Garde-fou singleton (module-scope).
 *
 * Le hook est appelé à la fois par le dashboard et par l'écran de course :
 * quand les deux sont montés (navigation empilée), on se retrouvait avec
 * DEUX `watchPositionAsync` et DEUX keep-awake simultanés — double
 * consommation GPS/batterie pour strictement la même information.
 *
 * On compte donc les abonnés : le watch natif n'est démarré que par le
 * premier et arrêté que par le dernier, quelle que soit la pile d'écrans.
 * Le `deliveryId` actif vit dans une ref module mise à jour par le dernier
 * appelant qui en fournit un non nul : le callback du watch (unique) lit
 * toujours la course courante sans redémarrer l'abonnement.
 */
const tracker: {
  subscribers: number;
  watch: Location.LocationSubscription | null;
  starting: boolean;
  deliveryId: string | null;
  lastSentAt: number;
  push: ((point: {
    latitude: number;
    longitude: number;
    deliveryId: string | null;
    heading: number | null;
    speedKmh: number | null;
    accuracyM: number | null;
  }) => void) | null;
} = {
  subscribers: 0,
  watch: null,
  starting: false,
  deliveryId: null,
  lastSentAt: 0,
  push: null,
};

async function startWatchIfNeeded() {
  // `starting` évite la course entre deux montages quasi simultanés :
  // sans lui, les deux appelants passeraient le test `watch === null`.
  if (tracker.watch || tracker.starting) return;
  tracker.starting = true;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    // Un désabonnement a pu survenir pendant l'attente de la permission.
    if (status !== 'granted' || tracker.subscribers === 0) return;

    // Empêche l'écran de s'éteindre pendant la course : le livreur consulte
    // l'adresse au feu rouge, il ne doit pas déverrouiller à chaque fois.
    void activateKeepAwakeAsync('delivery');

    tracker.watch = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: MIN_INTERVAL_MS,
        distanceInterval: MIN_DISTANCE_M,
      },
      (position) => {
        const now = Date.now();
        if (now - tracker.lastSentAt < MIN_INTERVAL_MS) return;
        tracker.lastSentAt = now;

        tracker.push?.({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          deliveryId: tracker.deliveryId,
          heading: position.coords.heading ?? null,
          speedKmh: position.coords.speed != null ? position.coords.speed * 3.6 : null,
          accuracyM: position.coords.accuracy ?? null,
        });
      },
    );

    // Dernier désabonné passé pendant le démarrage asynchrone du watch.
    if (tracker.subscribers === 0) stopWatch();
  } finally {
    tracker.starting = false;
  }
}

function stopWatch() {
  tracker.watch?.remove();
  tracker.watch = null;
  deactivateKeepAwake('delivery');
}

export function useLocationTracking(deliveryId: string | null, enabled: boolean) {
  const pushLocation = usePushLocation();
  const pushRef = useRef(pushLocation.mutate);
  pushRef.current = pushLocation.mutate;

  useEffect(() => {
    if (!enabled || !deliveryId) return;

    // Le dernier appelant avec un id non nul gagne : c'est toujours la
    // course réellement affichée (l'écran de course monte après le dashboard).
    tracker.deliveryId = deliveryId;
    tracker.push = (point) => pushRef.current(point);

    tracker.subscribers += 1;
    void startWatchIfNeeded();

    return () => {
      tracker.subscribers -= 1;
      if (tracker.subscribers === 0) stopWatch();
    };
    // pushLocation est stable (mutation React Query) et lu via pushRef :
    // l'inclure relancerait l'abonnement à chaque rendu.
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
