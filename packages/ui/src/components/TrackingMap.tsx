import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowsOutSimple } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Carte de suivi temps réel.
 *
 * Choix technique : Leaflet dans une WebView plutôt qu'un module natif
 * (Mapbox / react-native-maps).
 *
 *   - Fonctionne dans Expo Go ET dans les dev builds — aucun module natif,
 *     donc aucune recompilation pour tester sur le téléphone du gérant.
 *   - Tuiles OpenStreetMap/Carto et itinéraire OSRM : zéro clé API, zéro
 *     facture — un vrai sujet pour un restaurant indépendant à Kinshasa.
 *   - Les données vivantes (position, trace) transitent par `postMessage` :
 *     les marqueurs glissent sans jamais recharger la page.
 *
 * Deux modes :
 *   - carte-vignette (`onPress` fourni) : gestes coupés, un tap ouvre le
 *     plein écran ;
 *   - plein écran (`interactive`) : gestes, zoom, itinéraire routier OSRM et
 *     trace GPS réellement parcourue.
 */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface TrackingMapProps {
  /** Le restaurant — toujours affiché. */
  restaurant: MapPoint;
  /** L'adresse de livraison, si géocodée. */
  destination?: MapPoint | null;
  /** Position courante du livreur — le marqueur suit chaque mise à jour. */
  driver?: MapPoint | null;
  /** Trace GPS déjà parcourue (l'itinéraire réel du livreur). */
  trail?: MapPoint[];
  /** Trace l'itinéraire routier restaurant → destination (OSRM). */
  showRoute?: boolean;
  /** Gestes activés (plein écran). Coupés par défaut (vignette). */
  interactive?: boolean;
  /** Centre la carte sur le livreur à chaque mise à jour. */
  followDriver?: boolean;
  /** Hauteur de la vignette ; ignoré si `fill`. */
  height?: number;
  /** Occupe tout l'espace disponible (plein écran). */
  fill?: boolean;
  /** Tap sur la vignette (ouvre le plein écran). */
  onPress?: () => void;
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

function buildHtml(options: {
  restaurant: MapPoint;
  destination: MapPoint | null;
  dark: boolean;
  primary: string;
  interactive: boolean;
  followDriver: boolean;
  showRoute: boolean;
}): string {
  const { restaurant, destination, dark, primary, interactive, followDriver, showRoute } = options;

  const tiles = dark
    ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = dark
    ? '&copy; OpenStreetMap &copy; CARTO'
    : '&copy; OpenStreetMap contributors';

  // Vue satellite : imagerie Esri (gratuite, sans clé) + étiquettes des rues
  // par-dessus, sinon une photo aérienne sans un seul nom ne sert à rien.
  const satelliteTiles =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const satelliteLabels =
    'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png';

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; background: ${dark ? '#111' : '#eee'}; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    background: #fff; border: 2px solid ${primary};
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
    font-size: 17px; line-height: 1;
  }
  .pin.driver { background: ${primary}; border-color: #fff; }
  .leaflet-control-attribution { font-size: 8px; }
  /* Sélecteur Plan / Satellite dimensionné pour le pouce. */
  .leaflet-control-layers-toggle { width: 40px !important; height: 40px !important; }
  .leaflet-control-layers label { font-size: 14px; padding: 4px 6px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS}"></script>
<script>
  var interactive = ${interactive};
  var map = L.map('map', {
    zoomControl: interactive,
    attributionControl: true,
    dragging: interactive,
    touchZoom: interactive,
    doubleClickZoom: interactive,
    scrollWheelZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
  });
  var planLayer = L.tileLayer('${tiles}', { maxZoom: 19, attribution: '${attribution}' });
  var satelliteLayer = L.layerGroup([
    L.tileLayer('${satelliteTiles}', { maxZoom: 19, attribution: '&copy; Esri &mdash; Maxar, Earthstar Geographics' }),
    L.tileLayer('${satelliteLabels}', { maxZoom: 19, opacity: 0.9 }),
  ]);
  planLayer.addTo(map);

  if (interactive) {
    L.control.layers(
      { 'Plan': planLayer, 'Satellite': satelliteLayer },
      null,
      { position: 'topright', collapsed: false }
    ).addTo(map);
  }

  function icon(emoji, extra) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + (extra || '') + '">' + emoji + '</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  var restaurant = L.marker([${restaurant.latitude}, ${restaurant.longitude}], {
    icon: icon('\\uD83C\\uDF54'), // 🍔
  }).addTo(map).bindPopup('Istanbul Fast Food');

  var points = [restaurant.getLatLng()];
  var userMoved = false;
  map.on('dragstart zoomstart', function (e) {
    if (e.hard === undefined || !e.hard) userMoved = true;
  });

  ${
    destination
      ? `var destination = L.marker([${destination.latitude}, ${destination.longitude}], {
    icon: icon('\\uD83C\\uDFE0'), // 🏠
  }).addTo(map).bindPopup('Adresse de livraison');
  points.push(destination.getLatLng());`
      : 'var destination = null;'
  }

  // Trace GPS réellement parcourue par le livreur.
  var trail = L.polyline([], { color: '${primary}', weight: 4, opacity: 0.9 }).addTo(map);
  var driver = null;

  function fit() {
    if (userMoved) return; // ne pas se battre avec l'utilisateur
    var all = points.slice();
    if (driver) all.push(driver.getLatLng());
    trail.getLatLngs().forEach(function (p) { all.push(p); });
    if (all.length === 1) { map.setView(all[0], 15); }
    else { map.fitBounds(L.latLngBounds(all), { padding: [40, 40] }); }
  }
  fit();

  // Itinéraire routier réel (OSRM) restaurant → destination.
  ${
    showRoute && destination
      ? `fetch('${OSRM_URL}/${restaurant.longitude},${restaurant.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var geometry = data && data.routes && data.routes[0] && data.routes[0].geometry;
      if (!geometry) return;
      L.geoJSON(geometry, {
        style: { color: '${dark ? '#8ab4f8' : '#3b82f6'}', weight: 4, opacity: 0.55, dashArray: '2 8' },
      }).addTo(map);
    })
    .catch(function () {
      // Routage indisponible : trait direct en pointillés, faute de mieux.
      L.polyline([restaurant.getLatLng(), destination.getLatLng()], {
        color: '${primary}', weight: 2, opacity: 0.4, dashArray: '6 8',
      }).addTo(map);
    });`
      : destination
        ? `L.polyline([restaurant.getLatLng(), destination.getLatLng()], {
    color: '${primary}', weight: 2, opacity: 0.5, dashArray: '6 8',
  }).addTo(map);`
        : ''
  }

  // Glissement continu du marqueur entre deux positions GPS : la position
  // arrive toutes les ~10 s, on anime sur presque tout l'intervalle pour que
  // le scooter semble rouler en permanence, comme sur Google Maps.
  var follow = ${followDriver};
  var animFrame = null;
  function glideTo(target) {
    if (!driver) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    var start = driver.getLatLng();
    var t0 = performance.now();
    var duration = 9000;
    function step(now) {
      var k = Math.min(1, (now - t0) / duration);
      var lat = start.lat + (target[0] - start.lat) * k;
      var lng = start.lng + (target[1] - start.lng) * k;
      driver.setLatLng([lat, lng]);
      if (follow && !userMoved) map.panTo([lat, lng], { animate: false });
      if (k < 1) animFrame = requestAnimationFrame(step);
    }
    animFrame = requestAnimationFrame(step);
  }

  function onMessage(event) {
    try {
      var msg = JSON.parse(event.data);

      if (msg.type === 'driver' && typeof msg.latitude === 'number') {
        var pos = [msg.latitude, msg.longitude];
        if (!driver) {
          driver = L.marker(pos, { icon: icon('\\uD83D\\uDEF5', 'driver'), zIndexOffset: 1000 })
            .addTo(map).bindPopup('Votre livreur');
          fit();
        } else {
          glideTo(pos);
        }
        trail.addLatLng(pos);
      }

      if (msg.type === 'trail' && Array.isArray(msg.points)) {
        trail.setLatLngs(msg.points.map(function (p) { return [p.latitude, p.longitude]; }));
        fit();
      }
    } catch (e) { /* message inattendu : ignoré */ }
  }
  window.addEventListener('message', onMessage);   // iOS
  document.addEventListener('message', onMessage); // Android
</script>
</body>
</html>`;
}

export function TrackingMap({
  restaurant,
  destination = null,
  driver = null,
  trail,
  showRoute = false,
  interactive = false,
  followDriver = false,
  height = 220,
  fill = false,
  onPress,
}: TrackingMapProps) {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);

  // Dernières valeurs vivantes : renvoyées à la WebView quand elle finit de
  // charger (un postMessage émis avant le chargement serait perdu).
  const latest = useRef<{ driver: MapPoint | null; trail: MapPoint[] | undefined }>({
    driver,
    trail,
  });
  latest.current = { driver, trail };

  // La page n'est construite qu'une fois par thème/points fixes : tout le
  // reste transite par postMessage sans recharger la WebView.
  const html = useMemo(
    () =>
      buildHtml({
        restaurant,
        destination,
        dark: theme.scheme === 'dark',
        primary: theme.colors.primary,
        interactive,
        followDriver,
        showRoute,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurant.latitude,
      restaurant.longitude,
      destination?.latitude,
      destination?.longitude,
      theme.scheme,
      interactive,
      followDriver,
      showRoute,
    ],
  );

  const send = (payload: object) => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  };

  useEffect(() => {
    if (trail && trail.length > 0) send({ type: 'trail', points: trail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail?.length]);

  useEffect(() => {
    if (!driver) return;
    send({ type: 'driver', latitude: driver.latitude, longitude: driver.longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.latitude, driver?.longitude]);

  const handleLoadEnd = () => {
    const { trail: t, driver: d } = latest.current;
    if (t && t.length > 0) send({ type: 'trail', points: t });
    if (d) send({ type: 'driver', latitude: d.latitude, longitude: d.longitude });
  };

  return (
    <View
      style={{
        ...(fill ? { flex: 1 } : { height }),
        borderRadius: fill ? 0 : theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
      }}
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowsBackForwardNavigationGestures={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onLoadEnd={handleLoadEnd}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        // Une carte qui échoue (pas de réseau) ne doit pas faire tomber
        // l'écran de suivi : la WebView affiche simplement son fond.
        onError={() => undefined}
      />

      {/* Vignette : la WebView avale les touches, l'overlay les récupère. */}
      {onPress ? (
        <Pressable
          onPress={onPress}
          noScale
          accessibilityLabel="Ouvrir la carte en plein écran"
          style={StyleSheet.absoluteFillObject}
        >
          <View
            style={{
              position: 'absolute',
              right: theme.spacing.sm,
              top: theme.spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
            }}
          >
            <ArrowsOutSimple size={theme.iconSize.xs} color={theme.colors.text} weight="bold" />
            <Text variant="caption">Agrandir</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
