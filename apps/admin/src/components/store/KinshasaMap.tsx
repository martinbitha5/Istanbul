'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import { Crosshair, MapPin, Minus, Plus } from '@phosphor-icons/react';
import { KINSHASA_COMMUNES } from '@/lib/kinshasa';
import { KINSHASA_CENTER, KINSHASA_ZOOM, type GeoPoint } from '@/lib/geocode';

/**
 * La carte de Kinshasa de la vitrine.
 *
 * Choix technique, dans la continuité de `TrackingMap` côté mobile : Leaflet
 * sur des tuiles CARTO/OpenStreetMap. Pas de Mapbox ni de Google Maps — aucune
 * clé, aucune facture au millier d'affichages, et rien à renégocier le jour où
 * la vitrine reçoit du monde. Leaflet est ici une vraie dépendance du paquet
 * (et non un script CDN comme dans la WebView du mobile) : la vitrine est
 * rendue côté serveur et ne doit pas attendre un tiers pour peindre sa carte.
 *
 * Deux fonds :
 *   `positron` — gris clair, presque sans couleur. C'est le fond du sélecteur
 *                d'adresse : le repère et les anneaux de livraison doivent être
 *                les seules choses colorées de l'écran.
 *   `voyager`  — la cartographie complète, rues et quartiers nommés. C'est
 *                celui de la section « Zones desservies » de l'accueil, où la
 *                carte est le sujet et non l'outil.
 *
 * Le composant ne rend rien côté serveur (Leaflet touche `window` dès son
 * import) : il pose son conteneur, puis charge la bibliothèque dans un effet.
 * Un `next/dynamic` chez l'appelant serait redondant.
 */

export interface DeliveryRing {
  /** Rayon en kilomètres depuis le restaurant. */
  km: number;
  /** « 0–3 km · 2 $ · 25 min » — lu au survol de l'anneau. */
  label: string;
}

export interface KinshasaMapProps {
  /** Position de l'établissement — toujours affichée. */
  restaurant: GeoPoint & { name: string };
  /** Le repère de livraison, déplaçable si `onPinChange` est fourni. */
  pin?: GeoPoint | null;
  onPinChange?: (point: GeoPoint) => void;
  /** Anneaux de distance, du plus proche au plus lointain. */
  rings?: DeliveryRing[];
  /** Étiquettes des communes. */
  showCommunes?: boolean;
  basemap?: 'positron' | 'voyager';
  height?: number | string;
  /** Bouton « Ma position ». Sans effet si `onPinChange` est absent. */
  showLocate?: boolean;
  className?: string;
}

const TILES = {
  positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    ring: '#111111',
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    ring: '#111111',
  },
} as const;

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Repère du restaurant : carré noir à coins arrondis, couverts au centre. */
const RESTAURANT_PIN = `
<div style="position:relative;width:38px;height:44px">
  <div style="position:absolute;inset:0 0 6px 0;display:grid;place-items:center;background:#111;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.35)">
    <svg width="20" height="20" viewBox="0 0 256 256" fill="#fff" aria-hidden>
      <path d="M72 24v72a24 24 0 0 0 16 22.6V232a8 8 0 0 0 16 0V118.6A24 24 0 0 0 120 96V24a8 8 0 0 0-16 0v72a8 8 0 0 1-16 0V24a8 8 0 0 0-16 0Zm104 0c-22 0-40 26.9-40 60 0 27.2 12.2 50.2 29 57.5V232a8 8 0 0 0 16 0V24Z"/>
    </svg>
  </div>
  <div style="position:absolute;bottom:0;left:50%;width:10px;height:10px;background:#111;transform:translateX(-50%) rotate(45deg);border-radius:2px"></div>
</div>`;

/** Repère du client : goutte verte, la couleur de marque réservée au positif. */
const CUSTOMER_PIN = `
<div style="position:relative;width:34px;height:44px">
  <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden style="filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))">
    <path d="M17 43C17 43 32 26.5 32 16A15 15 0 1 0 2 16C2 26.5 17 43 17 43Z" fill="#06C167" stroke="#fff" stroke-width="3"/>
    <circle cx="17" cy="16" r="5.5" fill="#fff"/>
  </svg>
</div>`;

export function KinshasaMap({
  restaurant,
  pin = null,
  onPinChange,
  rings = [],
  showCommunes = false,
  basemap = 'positron',
  height = 320,
  showLocate = true,
  className = '',
}: KinshasaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const ringsRef = useRef<Circle[]>([]);
  const observerRef = useRef<ResizeObserver | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Le rappel change à chaque rendu du parent ; le passer en dépendance de
  // l'effet de construction recréerait la carte à chaque frappe dans le champ
  // d'adresse. Il vit donc dans une référence, lue au moment du clic.
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;

  // --- Construction, une seule fois ---------------------------------------
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [restaurant.lat || KINSHASA_CENTER.lat, restaurant.lng || KINSHASA_CENTER.lng],
        zoom: KINSHASA_ZOOM,
        zoomControl: false,
        attributionControl: true,
        // La molette fait défiler la page, pas la carte : une carte qui capte
        // le défilement au passage de la souris piège le visiteur au milieu de
        // l'accueil. Le zoom reste accessible par les boutons et le pincement.
        scrollWheelZoom: false,
      });

      L.tileLayer(TILES[basemap].url, {
        attribution: ATTRIBUTION,
        maxZoom: 20,
        subdomains: 'abcd',
        detectRetina: true,
      }).addTo(map);

      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

      L.marker([restaurant.lat, restaurant.lng], {
        icon: L.divIcon({
          html: RESTAURANT_PIN,
          className: '',
          iconSize: [38, 44],
          iconAnchor: [19, 44],
        }),
        zIndexOffset: 500,
        keyboard: false,
      })
        .addTo(map)
        .bindTooltip(restaurant.name, { direction: 'top', offset: [0, -46] });

      map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
        onPinChangeRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      mapRef.current = map;

      /**
       * Leaflet mesure son conteneur une fois, à la construction. Ici la
       * carte naît dans une modale qui s'ouvre, ou dans une grille dont les
       * colonnes ne sont pas encore réparties : au moment du `L.map()`, le
       * div fait souvent 0 × 0. Le symptôme est discret et trompeur — la
       * carte s'affiche, mais ne charge que deux tuiles et laisse du gris
       * autour. Un observateur de taille remet les compteurs à zéro à chaque
       * changement de dimension, ce qu'un unique `invalidateSize` différé ne
       * ferait pas (rotation du téléphone, ouverture du panier, colonne qui
       * se replie).
       */
      const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      observer.observe(containerRef.current);
      observerRef.current = observer;

      setReady(true);
    })();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
      ringsRef.current = [];
    };
    // Construction unique : restaurant et fond ne changent pas dans la vie du
    // composant (une nouvelle fiche remonterait un nouveau composant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Anneaux de distance -------------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    ringsRef.current.forEach((circle) => circle.remove());
    ringsRef.current = [];

    // Du plus large au plus étroit : le dernier ajouté est au-dessus, et c'est
    // le petit cercle qui doit rester cliquable au centre.
    [...rings]
      .sort((a, b) => b.km - a.km)
      .forEach((ring, index, all) => {
        const depth = all.length - index; // 1 pour le plus petit
        const circle = L.circle([restaurant.lat, restaurant.lng], {
          radius: ring.km * 1000,
          color: TILES[basemap].ring,
          weight: 1.5,
          opacity: 0.35,
          dashArray: '4 6',
          fillColor: '#06C167',
          fillOpacity: 0.055 * depth,
          interactive: true,
        })
          .addTo(map)
          .bindTooltip(ring.label, { sticky: true });

        ringsRef.current.push(circle);
      });

    if (rings.length > 0) {
      const widest = Math.max(...rings.map((ring) => ring.km));
      map.fitBounds(
        L.latLng(restaurant.lat, restaurant.lng).toBounds(widest * 2200),
        { padding: [20, 20] },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(rings), basemap]);

  // --- Étiquettes des communes --------------------------------------------
  //
  // Les 24 communes ne tiennent pas toutes à l'écran en vue d'ensemble : au
  // centre, Kintambo, Bandalungwa, Kasa-Vubu et Ngiri-Ngiri se chevauchent en
  // une bouillie illisible qui recouvre le repère du restaurant. On n'affiche
  // donc que les repères majeurs tant qu'on n'a pas zoomé, et la liste
  // complète au-delà — c'est ce que fait n'importe quelle carte routière.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!showCommunes) return;

    const label = (commune: (typeof KINSHASA_COMMUNES)[number]) =>
      L.marker([commune.lat, commune.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html: `<span style="display:block;white-space:nowrap;transform:translateX(-50%);font:600 11px/1.2 var(--ue-font-text,system-ui);color:#3f3f3f;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">${commune.name}</span>`,
          iconSize: [0, 0],
        }),
      });

    const major = L.layerGroup(
      KINSHASA_COMMUNES.filter((commune) => commune.major).map(label),
    ).addTo(map);
    const minor = L.layerGroup(
      KINSHASA_COMMUNES.filter((commune) => !commune.major).map(label),
    );

    const DETAIL_ZOOM = 12;
    const sync = () => {
      const detailed = map.getZoom() >= DETAIL_ZOOM;
      if (detailed && !map.hasLayer(minor)) minor.addTo(map);
      if (!detailed && map.hasLayer(minor)) minor.remove();
    };
    sync();
    map.on('zoomend', sync);

    return () => {
      map.off('zoomend', sync);
      major.remove();
      minor.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, showCommunes]);

  // --- Repère du client ----------------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!pin) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }

    if (!pinRef.current) {
      const marker = L.marker([pin.lat, pin.lng], {
        draggable: Boolean(onPinChangeRef.current),
        autoPan: true,
        zIndexOffset: 1000,
        icon: L.divIcon({
          html: CUSTOMER_PIN,
          className: '',
          iconSize: [34, 44],
          iconAnchor: [17, 44],
        }),
      }).addTo(map);

      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        onPinChangeRef.current?.({ lat, lng });
      });

      pinRef.current = marker;
    } else {
      pinRef.current.setLatLng([pin.lat, pin.lng]);
    }

    // Adresse et restaurant tiennent ensemble à l'écran : c'est cette vue qui
    // répond à « c'est loin de chez moi ? » sans que le client ait à zoomer.
    map.fitBounds(
      L.latLngBounds([
        [pin.lat, pin.lng],
        [restaurant.lat, restaurant.lng],
      ]),
      { padding: [60, 60], maxZoom: 16 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pin?.lat, pin?.lng]);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateError('Ce navigateur ne sait pas donner votre position.');
      return;
    }

    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onPinChangeRef.current?.({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocateError('Position refusée. Posez le repère sur la carte.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const zoom = (delta: 1 | -1) => {
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + delta);
  };

  return (
    <div
      // `isolate` n'est pas cosmétique : Leaflet empile ses panneaux à
      // z-index 400 et ses contrôles à 1000, dans le contexte racine. Sans
      // contexte d'empilement propre, la carte passerait par-dessus l'entête
      // collant de la vitrine (z-40) et par-dessus le voile des modales.
      className={`relative isolate overflow-hidden rounded-[var(--ue-radius)] ${className}`}
      style={{ height, background: 'var(--ue-surface-sunken)', zIndex: 0 }}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Contrôles maison : ceux de Leaflet sont des liens « + » et « − » de
          26 px, trop petits pour un pouce et hors de la charte. */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
        {onPinChange && showLocate ? (
          <MapButton
            label={locating ? 'Localisation…' : 'Utiliser ma position'}
            onClick={locate}
            disabled={locating}
          >
            <Crosshair size={18} weight="bold" aria-hidden />
          </MapButton>
        ) : null}
        <MapButton label="Zoomer" onClick={() => zoom(1)}>
          <Plus size={18} weight="bold" aria-hidden />
        </MapButton>
        <MapButton label="Dézoomer" onClick={() => zoom(-1)}>
          <Minus size={18} weight="bold" aria-hidden />
        </MapButton>
      </div>

      {onPinChange ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex justify-center">
          <p
            className="pointer-events-none flex items-center gap-2 rounded-[var(--ue-pill)] px-3.5 py-2 text-sm font-medium"
            style={{ background: 'var(--ue-surface)', boxShadow: 'var(--ue-shadow-pop)' }}
          >
            <MapPin size={16} weight="fill" aria-hidden />
            {locateError ?? 'Touchez la carte ou glissez le repère'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MapButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 cursor-pointer place-items-center rounded-full disabled:opacity-60"
      style={{ background: 'var(--ue-surface)', boxShadow: 'var(--ue-shadow-pop)' }}
    >
      {children}
    </button>
  );
}
