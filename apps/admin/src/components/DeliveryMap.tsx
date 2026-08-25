'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildMapHtml, type MapPoint, type MapRouteInfo } from '@istanbul/map';

/**
 * Carte de livraison du back-office.
 *
 * Exactement la même page que celle des applications mobiles — `@istanbul/map`
 * la construit une fois pour les trois surfaces. Ici elle est posée dans une
 * iframe plutôt que dans une WebView, et alimentée par le même protocole de
 * messages. Une carte qui diverge entre le téléphone du livreur et l'écran du
 * gérant, c'est deux versions de la vérité pendant un coup de feu.
 *
 * L'iframe n'est pas `sandbox`ée : le HTML est intégralement généré par nous,
 * et une origine opaque empêcherait Mapbox GL de lancer ses web workers.
 */

export interface DeliveryMapProps {
  restaurant: MapPoint;
  destination?: MapPoint | null;
  driver?: MapPoint | null;
  trail?: MapPoint[];
  /** Hauteur en pixels. */
  height?: number;
  className?: string;
  onRoute?: (info: MapRouteInfo) => void;
}

export function DeliveryMap({
  restaurant,
  destination = null,
  driver = null,
  trail,
  height = 260,
  className,
  onRoute,
}: DeliveryMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Le callback passe par une ref : la page ne doit être construite qu'une
  // fois, un `onRoute` recréé à chaque rendu la rechargerait sans arrêt.
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  const html = useMemo(
    () =>
      buildMapHtml({
        restaurant,
        destination,
        interactive: true,
        showRoute: true,
        labels: { driver: 'Livreur' },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurant.latitude, restaurant.longitude, destination?.latitude, destination?.longitude],
  );

  const send = useCallback((payload: object) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  }, []);

  // Réception : on ne lit que les messages émis par NOTRE iframe. Le dashboard
  // vit dans un navigateur, d'autres scripts y postent des messages.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (typeof event.data !== 'string') return;

      try {
        const message = JSON.parse(event.data) as { type?: string } & MapRouteInfo;
        if (message.type === 'ready') setReady(true);
        if (message.type === 'route') {
          onRouteRef.current?.({
            distanceKm: message.distanceKm,
            durationMin: message.durationMin,
            source: message.source,
          });
        }
      } catch {
        /* message inattendu : ignoré */
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // La page repart de zéro quand son HTML change (autre commande ouverte) :
  // sans ce reset, `ready` resterait vrai et la nouvelle page ne recevrait
  // jamais la position ni la trace.
  useEffect(() => {
    setReady(false);
  }, [html]);

  // `ready` dans les dépendances : la carte annonce elle-même qu'elle écoute.
  // Un postMessage envoyé sur l'événement `load` de l'iframe partait parfois
  // avant que le script de la page n'ait installé son écouteur.
  //
  // Les dépendances sont les valeurs, pas les objets : react-query en renvoie
  // de nouveaux à chaque rendu, et le puck redémarrerait son animation pour
  // une position inchangée.
  useEffect(() => {
    if (!ready || !trail || trail.length === 0) return;
    send({ type: 'trail', points: trail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trail?.length]);

  useEffect(() => {
    if (!ready || !driver) return;
    send({ type: 'driver', latitude: driver.latitude, longitude: driver.longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, driver?.latitude, driver?.longitude]);

  return (
    <iframe
      ref={frameRef}
      title="Carte de la livraison"
      srcDoc={html}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height,
        border: 0,
        borderRadius: 12,
        background: 'var(--color-surface-sunken)',
      }}
    />
  );
}
