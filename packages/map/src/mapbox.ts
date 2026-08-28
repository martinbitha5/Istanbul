import type { MapHtmlOptions } from './types';

/**
 * Page de carte Mapbox GL JS.
 *
 * Pourquoi Mapbox GL dans une page web plutôt que `@rnmapbox/maps` : le module
 * natif imposerait un dev build à chaque test sur le téléphone du gérant, et
 * n'existerait pas pour le dashboard. Ici, une seule page sert la vitrine
 * mobile, l'app livreur et le back-office — même style, même tracé, même puck.
 *
 * Ce qu'on emprunte à Uber, et pourquoi :
 *   - tracé noir épais posé sur un liseré blanc — lisible sur l'asphalte gris
 *     comme sur la végétation ;
 *   - un « puck » orienté dans le sens de la marche plutôt qu'une épingle :
 *     la direction du livreur se lit sans réfléchir ;
 *   - vue inclinée et carte qui pivote côté livreur uniquement : le client veut
 *     une vue de dessus (où en est ma commande), le livreur veut savoir où
 *     tourner.
 *
 * Le trafic vient de `driving-traffic` : à Kinshasa la couverture est partielle,
 * l'API retombe alors sur les vitesses libres — l'ETA reste meilleur que notre
 * approximation « vol d'oiseau × 1,35 ».
 */

/** Version épinglée : une carte qui change de rendu au gré d'un CDN, non. */
const GL_VERSION = 'v3.9.0';

/**
 * Un seul style, la vue satellite : imagerie plus les rues et leurs noms
 * par-dessus. Le mode « Plan » façon Uber (navigation-day) a été retiré —
 * même carte pour le client, le livreur et la vitrine, sans sélecteur.
 */
export const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

export function buildMapboxHtml(options: MapHtmlOptions): string {
  const {
    token,
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

  // Tout ce qui vient de l'hôte passe par JSON.stringify : aucune valeur n'est
  // concaténée dans le corps du script, donc aucune injection possible et un
  // script lisible d'un bout à l'autre.
  const constants = [
    ['TOKEN', token],
    ['STYLE', MAPBOX_STYLE],
    ['RESTAURANT', [restaurant.longitude, restaurant.latitude]],
    ['DESTINATION', destination ? [destination.longitude, destination.latitude] : null],
    ['INTERACTIVE', interactive],
    ['NAV', navigation],
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
    ['PADDING', interactive ? 64 : 40],
  ]
    .map(([name, value]) => `var ${name} = ${JSON.stringify(value)};`)
    .join('\n  ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/${GL_VERSION}/mapbox-gl.css" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  body {
    background: ${colors.background};
    font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  #map { position: absolute; inset: 0; }

  /* --- Repères ---------------------------------------------------------- */
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 11px;
    background: #fff; border: 2px solid ${colors.route};
    box-shadow: 0 2px 8px rgba(0,0,0,.28);
    font-size: 16px; line-height: 1;
  }
  .pin.home { border-radius: 50%; }

  /* Le puck : halo qui respire, disque blanc, flèche orientée. Le halo dit
     « position vivante » sans qu'on ait à écrire « en direct » quelque part. */
  .puck { position: relative; width: 44px; height: 44px; }
  .puck .halo {
    position: absolute; inset: 0; border-radius: 50%;
    background: ${colors.trail}; opacity: .22;
    animation: breathe 2.4s ease-in-out infinite;
  }
  .puck .body {
    position: absolute; left: 5px; top: 5px;
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.35);
    font-size: 16px; line-height: 1;
  }
  /* La flèche pivote autour du centre du PUCK (44/2 = 22 px), pas du sien :
     elle orbite donc autour du disque au lieu de tourner sur place.
     Origine = centre du puck exprimé dans le repère de la flèche :
     x = 22 - 15 = 7, y = 22 - (-7) = 29. */
  .puck .arrow { position: absolute; left: 15px; top: -7px; transform-origin: 7px 29px; }
  @keyframes breathe {
    0%, 100% { transform: scale(.8); opacity: .28; }
    50%      { transform: scale(1);  opacity: .10; }
  }

  /* --- Commandes flottantes -------------------------------------------- */
  #ctrl {
    display: none; position: absolute; right: 10px; top: 10px;
    flex-direction: column; align-items: flex-end; gap: 8px; z-index: 2;
  }
  #recenter {
    appearance: none; border: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 50%;
    background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.22);
  }

  #notice {
    display: none; position: absolute; inset: 0; z-index: 3;
    align-items: center; justify-content: center; padding: 24px;
    text-align: center; color: #545454; background: ${colors.background};
  }

  /* Le logo et l'attribution Mapbox sont contractuels : on les garde, on les
     rend seulement discrets. */
  .mapboxgl-ctrl-attrib { font-size: 9px; }
  .mapboxgl-ctrl-bottom-right { z-index: 1; }
</style>
</head>
<body>
<div id="map"></div>

<div id="ctrl">
  <button id="recenter" type="button" aria-label="Recentrer la carte">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${colors.route}" stroke-width="2">
      <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" stroke-opacity=".35" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke-linecap="round" />
    </svg>
  </button>
</div>

<div id="notice"><p>Carte indisponible.<br />Vérifiez la connexion internet.</p></div>

<script src="https://api.mapbox.com/mapbox-gl-js/${GL_VERSION}/mapbox-gl.js"></script>
<script>
(function () {
  ${constants}

  var notice = document.getElementById('notice');
  function fail() { notice.style.display = 'flex'; }

  // mapboxgl.supported() a disparu en v3 (WebGL 2 y est un prérequis) : on ne
  // l'appelle que s'il existe, sinon la garde condamnerait la carte partout.
  if (typeof mapboxgl === 'undefined') { fail(); return; }
  if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) { fail(); return; }

  // --- Pont avec l'hôte ---------------------------------------------------
  // Même page, deux conteneurs : WebView React Native et iframe du dashboard.
  // On tente les deux canaux, celui qui n'existe pas échoue silencieusement.
  function send(payload) {
    var body = JSON.stringify(payload);
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(body); } catch (e) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(body, '*'); } catch (e) {}
  }

  mapboxgl.accessToken = TOKEN;

  var map = new mapboxgl.Map({
    container: 'map',
    style: STYLE,
    center: RESTAURANT,
    zoom: 14,
    pitch: NAV ? 55 : 0,
    interactive: INTERACTIVE,
    attributionControl: true,
    logoPosition: 'bottom-left',
    fadeDuration: 0,
  });

  // 401 = jeton absent, révoqué ou restreint à d'autres URLs. Sans ce garde-fou
  // la carte reste un rectangle vide, et personne ne sait pourquoi.
  map.on('error', function (event) {
    var status = event && event.error && event.error.status;
    if (status === 401 || status === 403) {
      notice.innerHTML =
        "<p>Jeton Mapbox refusé.<br />Vérifiez la clé publique et ses restrictions d'URL.</p>";
      fail();
    }
  });

  // Vue client et vue dashboard : jamais de rotation subie. Le livreur, lui,
  // a besoin que la carte pivote — c'est le sens même de la vue navigation.
  if (INTERACTIVE && !NAV) {
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
  }

  // --- État vivant --------------------------------------------------------
  var driverPos = null;      // [lng, lat]
  var driverMarker = null;
  var driverArrow = null;
  var trailCoords = [];
  var routeGeo = null;
  var userMoved = false;

  function line(coords) {
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords || [] } };
  }

  function marker(html, className, coords) {
    var node = document.createElement('div');
    node.className = className;
    node.innerHTML = html;
    return new mapboxgl.Marker({ element: node, anchor: 'center' }).setLngLat(coords).addTo(map);
  }

  // --- Repères fixes ------------------------------------------------------
  marker('\\uD83C\\uDF54', 'pin', RESTAURANT).setPopup(
    new mapboxgl.Popup({ offset: 22, closeButton: false }).setText(LABELS.restaurant)
  );

  if (DESTINATION) {
    marker('\\uD83C\\uDFE0', 'pin home', DESTINATION).setPopup(
      new mapboxgl.Popup({ offset: 22, closeButton: false }).setText(LABELS.destination)
    );
  }

  // --- Calques posés sous les étiquettes ----------------------------------
  // Un tracé au-dessus des noms de rue masque exactement l'information dont on
  // a besoin pour se repérer : il passe donc sous la première couche de texte.
  //
  // « Première couche de texte », et non « premier calque symbole » : dans le
  // style navigation, le premier symbole est turning-feature-outline en
  // position 29, alors que les routes s'empilent jusqu'à la 101. Viser le
  // symbole glissait le tracé SOUS toutes les chaussées — il disparaissait
  // dès qu'il empruntait une avenue large, et ne réapparaissait que dans les
  // ruelles. On cherche donc le premier calque qui porte réellement du texte.
  function firstLabelLayer() {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i += 1) {
      var layer = layers[i];
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) return layer.id;
    }
    return undefined;
  }

  // Trafic et incidents : le style satellite-streets n'en embarque pas, on
  // éteint quand même toute source de ce type par prudence — à Kinshasa la
  // couverture est nulle et ce vert fluo entrerait en collision avec la trace.
  // L'ETA, lui, garde bien le trafic — il vient de l'API Directions.
  function hideTrafficLayers() {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i += 1) {
      if (layers[i].source === 'mapbox-traffic' || layers[i].source === 'mapbox-incidents') {
        try { map.setLayoutProperty(layers[i].id, 'visibility', 'none'); } catch (e) {}
      }
    }
  }

  function applyOverlays() {
    hideTrafficLayers();

    var before = firstLabelLayer();

    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: line([]) });
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 11, 'line-opacity': 0.95 },
      }, before);
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.route, 'line-width': 6 },
      }, before);
    }

    if (!map.getSource('trail')) {
      map.addSource('trail', { type: 'geojson', data: line([]) });
      map.addLayer({
        id: 'trail-line', type: 'line', source: 'trail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.trail, 'line-width': 5, 'line-opacity': 0.95 },
      }, before);
    }

    // Pas de relief bâti en extrusion : sur l'imagerie satellite, les toits
    // sont déjà là — des volumes gris par-dessus ne feraient que les masquer.

    pushData();
  }

  function pushData() {
    var route = map.getSource('route');
    var trail = map.getSource('trail');
    if (route) route.setData(routeGeo ? line(routeGeo.coordinates) : line([]));
    if (trail) trail.setData(line(trailCoords));
  }

  map.on('style.load', applyOverlays);

  map.on('load', function () {
    fit(true);
    send({ type: 'ready' });
    requestRoute();
  });

  // --- Cadrage ------------------------------------------------------------
  // originalEvent distingue le geste de l'utilisateur de nos propres
  // animations : sans lui, notre premier easeTo se prenait pour un geste et la
  // carte cessait aussitôt de suivre le livreur.
  map.on('dragstart', function (e) { if (e.originalEvent) userMoved = true; });
  map.on('zoomstart', function (e) { if (e.originalEvent) userMoved = true; });
  map.on('rotatestart', function (e) { if (e.originalEvent) userMoved = true; });

  function fit(instant) {
    if (userMoved) return;

    var points = [RESTAURANT];
    if (DESTINATION) points.push(DESTINATION);
    if (driverPos) points.push(driverPos);
    if (routeGeo) {
      // Un itinéraire qui contourne un obstacle sort du cadre des extrémités :
      // on cadre sur le tracé, pas sur les deux points.
      for (var i = 0; i < routeGeo.coordinates.length; i += 8) points.push(routeGeo.coordinates[i]);
    }
    trailCoords.forEach(function (c) { points.push(c); });

    if (points.length === 1) {
      map.jumpTo({ center: points[0], zoom: 15 });
      return;
    }

    var bounds = points.reduce(function (acc, p) { return acc.extend(p); },
      new mapboxgl.LngLatBounds(points[0], points[0]));

    map.fitBounds(bounds, {
      padding: PADDING,
      maxZoom: 16.5,
      duration: instant ? 0 : 500,
      pitch: NAV ? 55 : 0,
    });
  }

  // --- Livreur ------------------------------------------------------------
  function bearingBetween(from, to) {
    var rad = Math.PI / 180;
    var y = Math.sin((to[0] - from[0]) * rad) * Math.cos(to[1] * rad);
    var x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad) -
            Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos((to[0] - from[0]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  }

  function metersBetween(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b[1] - a[1]) * rad;
    var dLng = (b[0] - a[0]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 6371000 * 2 * Math.asin(Math.sqrt(h));
  }

  function createDriver(pos) {
    var arrow = '<svg class="arrow" width="14" height="14" viewBox="0 0 12 12">' +
      '<path d="M6 0 L11 11 L6 8.4 L1 11 Z" fill="' + COLORS.route + '"/></svg>';
    var node = document.createElement('div');
    node.className = 'puck';
    node.innerHTML = '<div class="halo"></div><div class="body">\\uD83D\\uDEF5</div>' + arrow;
    driverArrow = node.querySelector('.arrow');
    // Le marqueur ne tourne pas : seule la flèche le fait. Faire pivoter tout
    // l'élément (Marker.setRotation) retournait aussi le scooter — tête en bas
    // dès que le livreur roule vers le sud. Le disque reste donc droit et la
    // direction est portée par la seule flèche, comme sur un GPS.
    driverMarker = new mapboxgl.Marker({ element: node, anchor: 'center' })
      .setLngLat(pos).addTo(map);
    driverMarker.setPopup(new mapboxgl.Popup({ offset: 26, closeButton: false }).setText(LABELS.driver));
  }

  // La position arrive toutes les 10 à 15 s. Sans interpolation, le puck
  // sauterait de bloc en bloc ; on l'anime sur presque tout l'intervalle pour
  // qu'il paraisse rouler en continu.
  var animation = null;
  function glideTo(target) {
    if (!driverMarker) return;
    if (animation) cancelAnimationFrame(animation);

    var start = driverMarker.getLngLat().toArray();
    var heading = bearingBetween(start, target);
    var moved = metersBetween(start, target);
    // Sous 8 m, c'est du bruit GPS : garder l'ancien cap évite un puck qui
    // pivote sur place à l'arrêt.
    if (moved > 8) setHeading(heading);

    var t0 = performance.now();
    var duration = 9000;

    (function step(now) {
      var k = Math.min(1, (now - t0) / duration);
      var pos = [
        start[0] + (target[0] - start[0]) * k,
        start[1] + (target[1] - start[1]) * k,
      ];
      driverMarker.setLngLat(pos);
      if (FOLLOW && !userMoved) {
        // jumpTo et non easeTo : on est déjà dans une boucle d'animation, une
        // seconde interpolation par-dessus donnerait un mouvement caoutchouteux.
        map.jumpTo({
          center: pos,
          bearing: NAV ? heading : map.getBearing(),
          pitch: NAV ? 55 : map.getPitch(),
        });
      }
      if (k < 1) animation = requestAnimationFrame(step);
    })(t0);
  }

  // Cap en degrés vrais. La flèche, elle, est dessinée à l'écran : elle doit
  // donc être corrigée de l'orientation courante de la carte, sinon elle
  // désigne le nord géographique au lieu de la route qui est devant.
  var driverHeading = null;

  function setHeading(heading) {
    driverHeading = heading;
    paintHeading();
  }

  function paintHeading() {
    if (!driverArrow || driverHeading === null) return;
    driverArrow.style.transform = 'rotate(' + (driverHeading - map.getBearing()) + 'deg)';
  }

  // En vue navigation la carte pivote en continu : sans ce rafraîchissement,
  // la flèche resterait figée sur son cap d'origine pendant les virages.
  map.on('rotate', paintHeading);

  function onDriver(latitude, longitude) {
    var pos = [longitude, latitude];

    if (!driverMarker) {
      driverPos = pos;
      createDriver(pos);
      if (FOLLOW && !userMoved) {
        map.easeTo({ center: pos, zoom: NAV ? 16.5 : map.getZoom(), pitch: NAV ? 55 : 0, duration: 600 });
      } else {
        fit(false);
      }
    } else {
      driverPos = pos;
      glideTo(pos);
    }

    // La trace suit la position : chaque point reçu est un point réellement
    // parcouru, c'est ce qui distingue le trait plein du tracé conseillé.
    trailCoords.push(pos);
    pushData();
    requestRoute();
  }

  // --- Itinéraire ---------------------------------------------------------
  var lastRouteFrom = null;
  var lastRouteAt = 0;

  function routeDestination() {
    return ROUTE_TO === 'restaurant' ? RESTAURANT : DESTINATION;
  }

  function requestRoute() {
    if (!SHOW_ROUTE) return;

    var to = routeDestination();
    if (!to) return;

    // Le livreur qui part chercher la commande veut le trajet depuis SA
    // position ; tant qu'elle est inconnue, il n'y a rien d'utile à tracer.
    var from = driverPos || (ROUTE_TO === 'restaurant' ? null : RESTAURANT);
    if (!from) return;

    var now = Date.now();
    if (lastRouteFrom && metersBetween(lastRouteFrom, from) < 120 && now - lastRouteAt < 45000) return;
    lastRouteFrom = from;
    lastRouteAt = now;

    var pair = from[0] + ',' + from[1] + ';' + to[0] + ',' + to[1];

    fetch('https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' + pair +
          '?geometries=geojson&overview=full&alternatives=false&access_token=' + encodeURIComponent(TOKEN))
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var best = data && data.routes && data.routes[0];
        if (!best || !best.geometry) throw new Error('itineraire vide');
        setRoute(best.geometry, best.distance, best.duration, 'mapbox');
      })
      .catch(function () { osrmRoute(from, to); });
  }

  // Repli : le service public OSRM, puis le trait droit. Une carte sans tracé
  // du tout serait pire qu'un tracé approximatif.
  function osrmRoute(from, to) {
    var pair = from[0] + ',' + from[1] + ';' + to[0] + ',' + to[1];
    fetch('https://router.project-osrm.org/route/v1/driving/' + pair + '?overview=full&geometries=geojson')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var best = data && data.routes && data.routes[0];
        if (!best || !best.geometry) throw new Error('itineraire vide');
        setRoute(best.geometry, best.distance, best.duration, 'osrm');
      })
      .catch(function () {
        var metres = metersBetween(from, to);
        setRoute({ type: 'LineString', coordinates: [from, to] }, metres * 1.35, (metres * 1.35) / 5, 'direct');
      });
  }

  function setRoute(geometry, metres, seconds, source) {
    routeGeo = geometry;
    pushData();
    if (!NAV) fit(false);
    send({
      type: 'route',
      distanceKm: Math.round(metres / 100) / 10,
      durationMin: Math.max(1, Math.round(seconds / 60)),
      source: source,
    });
  }

  // --- Commandes ----------------------------------------------------------
  if (INTERACTIVE) {
    document.getElementById('ctrl').style.display = 'flex';

    document.getElementById('recenter').addEventListener('click', function () {
      userMoved = false;
      if (FOLLOW && driverPos) {
        map.easeTo({ center: driverPos, zoom: NAV ? 16.5 : 15.5, pitch: NAV ? 55 : 0, duration: 500 });
      } else {
        fit(false);
      }
    });
  }

  // --- Messages de l'hôte -------------------------------------------------
  function onHostMessage(event) {
    if (typeof event.data !== 'string') return;

    var message;
    try { message = JSON.parse(event.data); } catch (e) { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'driver' && typeof message.latitude === 'number') {
      onDriver(message.latitude, message.longitude);
    }

    if (message.type === 'trail' && Array.isArray(message.points)) {
      trailCoords = message.points.map(function (p) { return [p.longitude, p.latitude]; });
      pushData();
      fit(false);
    }

    if (message.type === 'recenter') {
      userMoved = false;
      fit(false);
    }
  }

  window.addEventListener('message', onHostMessage);   // iOS + iframe
  document.addEventListener('message', onHostMessage); // Android
})();
</script>
</body>
</html>`;
}
