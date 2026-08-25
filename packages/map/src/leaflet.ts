import type { MapHtmlOptions } from './types';

/**
 * Repli sans clé : Leaflet, tuiles OpenStreetMap, routage OSRM.
 *
 * C'était la carte du projet avant Mapbox, et elle reste le filet : tant que
 * `EXPO_PUBLIC_MAPBOX_TOKEN` / `NEXT_PUBLIC_MAPBOX_TOKEN` n'est pas renseigné —
 * ou le jour où le quota Mapbox tombe — les trois applications continuent
 * d'afficher une carte utilisable, sans clé et sans facture.
 *
 * Le rendu est volontairement plus modeste que la version Mapbox : c'est un
 * mode dégradé, pas une alternative à choisir. Le protocole de messages, lui,
 * est strictement le même — l'hôte ne sait pas laquelle des deux pages il
 * affiche.
 */

const LEAFLET_VERSION = '1.9.4';

export function buildLeafletHtml(options: MapHtmlOptions): string {
  const {
    restaurant,
    destination = null,
    interactive = false,
    navigation = false,
    followDriver = false,
    showRoute = false,
    routeTo = 'destination',
    colors,
    labels,
  } = options;

  const constants = [
    ['RESTAURANT', [restaurant.latitude, restaurant.longitude]],
    ['DESTINATION', destination ? [destination.latitude, destination.longitude] : null],
    ['INTERACTIVE', interactive],
    ['FOLLOW', followDriver || navigation],
    ['SHOW_ROUTE', showRoute],
    ['ROUTE_TO', routeTo],
    ['COLORS', colors],
    [
      'LABELS',
      {
        restaurant: labels?.restaurant ?? 'Istanbul Fast Food',
        destination: labels?.destination ?? 'Adresse de livraison',
        driver: labels?.driver ?? 'Livreur',
      },
    ],
    ['PADDING', interactive ? 60 : 40],
  ]
    .map(([name, value]) => `var ${name} = ${JSON.stringify(value)};`)
    .join('\n  ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; background: ${colors.background}; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 11px;
    background: #fff; border: 2px solid ${colors.route};
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
    font-size: 16px; line-height: 1;
  }
  .pin.home { border-radius: 50%; }
  .pin.driver { border-radius: 50%; border-color: ${colors.trail}; }
  .leaflet-control-attribution { font-size: 8px; }
  /* Sélecteur Plan / Satellite dimensionné pour le pouce. */
  .leaflet-control-layers-toggle { width: 40px !important; height: 40px !important; }
  .leaflet-control-layers label { font-size: 14px; padding: 4px 6px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
(function () {
  ${constants}

  if (typeof L === 'undefined') return;

  function send(payload) {
    var body = JSON.stringify(payload);
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(body); } catch (e) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(body, '*'); } catch (e) {}
  }

  var map = L.map('map', {
    zoomControl: INTERACTIVE,
    attributionControl: true,
    dragging: INTERACTIVE,
    touchZoom: INTERACTIVE,
    doubleClickZoom: INTERACTIVE,
    scrollWheelZoom: INTERACTIVE,
    boxZoom: INTERACTIVE,
    keyboard: INTERACTIVE,
  });

  var plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  // Vue satellite : imagerie Esri (gratuite, sans clé) plus les étiquettes des
  // rues par-dessus — une photo aérienne sans un seul nom ne sert à rien.
  var satellite = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: '&copy; Esri &mdash; Maxar, Earthstar Geographics',
    }),
    L.tileLayer('https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.9 }),
  ]);

  if (INTERACTIVE) {
    L.control.layers({ 'Plan': plan, 'Satellite': satellite }, null, {
      position: 'topright', collapsed: false,
    }).addTo(map);
  }

  function icon(glyph, extra) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + (extra || '') + '">' + glyph + '</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  var restaurant = L.marker(RESTAURANT, { icon: icon('\\uD83C\\uDF54') })
    .addTo(map).bindPopup(LABELS.restaurant);

  var destination = DESTINATION
    ? L.marker(DESTINATION, { icon: icon('\\uD83C\\uDFE0', 'home') }).addTo(map).bindPopup(LABELS.destination)
    : null;

  var trail = L.polyline([], { color: COLORS.trail, weight: 5, opacity: 0.95 }).addTo(map);
  var route = null;
  var driver = null;
  var driverPos = null;
  var userMoved = false;

  map.on('dragstart zoomstart', function (e) {
    if (e.hard === undefined || !e.hard) userMoved = true;
  });

  function fit() {
    if (userMoved) return;
    var points = [restaurant.getLatLng()];
    if (destination) points.push(destination.getLatLng());
    if (driver) points.push(driver.getLatLng());
    if (route) route.getLatLngs().forEach(function (p) { points.push(p); });
    trail.getLatLngs().forEach(function (p) { points.push(p); });

    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [PADDING, PADDING], maxZoom: 16 });
  }
  fit();

  function metersBetween(a, b) {
    return map.distance(L.latLng(a[0], a[1]), L.latLng(b[0], b[1]));
  }

  // --- Itinéraire (OSRM, sans clé) ---------------------------------------
  var lastRouteFrom = null;
  var lastRouteAt = 0;

  function requestRoute() {
    if (!SHOW_ROUTE) return;

    var to = ROUTE_TO === 'restaurant' ? RESTAURANT : DESTINATION;
    if (!to) return;

    var from = driverPos || (ROUTE_TO === 'restaurant' ? null : RESTAURANT);
    if (!from) return;

    var now = Date.now();
    if (lastRouteFrom && metersBetween(lastRouteFrom, from) < 120 && now - lastRouteAt < 45000) return;
    lastRouteFrom = from;
    lastRouteAt = now;

    var pair = from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0];

    fetch('https://router.project-osrm.org/route/v1/driving/' + pair + '?overview=full&geometries=geojson')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var best = data && data.routes && data.routes[0];
        if (!best || !best.geometry) throw new Error('itineraire vide');
        setRoute(
          best.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
          best.distance, best.duration, 'osrm'
        );
      })
      .catch(function () {
        var metres = metersBetween(from, to);
        setRoute([from, to], metres * 1.35, (metres * 1.35) / 5, 'direct');
      });
  }

  function setRoute(latlngs, metres, seconds, source) {
    if (route) map.removeLayer(route);
    route = L.polyline(latlngs, { color: COLORS.route, weight: 5, opacity: 0.75 }).addTo(map);
    route.bringToBack();
    fit();
    send({
      type: 'route',
      distanceKm: Math.round(metres / 100) / 10,
      durationMin: Math.max(1, Math.round(seconds / 60)),
      source: source,
    });
  }

  // --- Livreur ------------------------------------------------------------
  var animation = null;
  function glideTo(target) {
    if (!driver) return;
    if (animation) cancelAnimationFrame(animation);

    var start = driver.getLatLng();
    var t0 = performance.now();
    var duration = 9000;

    (function step(now) {
      var k = Math.min(1, (now - t0) / duration);
      var lat = start.lat + (target[0] - start.lat) * k;
      var lng = start.lng + (target[1] - start.lng) * k;
      driver.setLatLng([lat, lng]);
      if (FOLLOW && !userMoved) map.panTo([lat, lng], { animate: false });
      if (k < 1) animation = requestAnimationFrame(step);
    })(t0);
  }

  function onDriver(latitude, longitude) {
    var pos = [latitude, longitude];
    driverPos = pos;

    if (!driver) {
      driver = L.marker(pos, { icon: icon('\\uD83D\\uDEF5', 'driver'), zIndexOffset: 1000 })
        .addTo(map).bindPopup(LABELS.driver);
      fit();
    } else {
      glideTo(pos);
    }

    trail.addLatLng(pos);
    requestRoute();
  }

  function onHostMessage(event) {
    if (typeof event.data !== 'string') return;

    var message;
    try { message = JSON.parse(event.data); } catch (e) { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'driver' && typeof message.latitude === 'number') {
      onDriver(message.latitude, message.longitude);
    }

    if (message.type === 'trail' && Array.isArray(message.points)) {
      trail.setLatLngs(message.points.map(function (p) { return [p.latitude, p.longitude]; }));
      fit();
    }

    if (message.type === 'recenter') {
      userMoved = false;
      fit();
    }
  }

  window.addEventListener('message', onHostMessage);   // iOS + iframe
  document.addEventListener('message', onHostMessage); // Android

  send({ type: 'ready' });
  requestRoute();
})();
</script>
</body>
</html>`;
}
