import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ArrowsOutSimple } from 'phosphor-react-native';
import { buildMapHtml, type MapPoint, type MapRouteInfo } from '@istanbul/map';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Carte de suivi temps réel.
 *
 * Le rendu vit dans `@istanbul/map` : une page web unique que le client, le
 * livreur et le dashboard partagent. Ce composant n'est que le porteur React
 * Native — il installe la WebView, pousse les données vivantes par
 * `postMessage` et remonte l'itinéraire calculé.
 *
 * Le choix de la WebView plutôt qu'un module natif tient toujours : aucun
 * module natif, donc aucune recompilation pour tester sur le téléphone du
 * gérant, et la même carte exactement dans le back-office.
 *
 * Trois modes :
 *   - vignette (`onPress` fourni) : gestes coupés, un tap ouvre le plein écran ;
 *   - plein écran (`interactive`) : gestes, zoom, bascule Plan/Satellite ;
 *   - navigation (`navigation`) : caméra inclinée, orientée dans le sens de la
 *     marche, verrouillée sur le livreur — la vue de l'app livreur.
 */

export type { MapPoint, MapRouteInfo };

export interface TrackingMapProps {
  /** Le restaurant — toujours affiché. */
  restaurant: MapPoint;
  /** L'adresse de livraison, si géocodée. */
  destination?: MapPoint | null;
  /** Position courante du livreur — le marqueur suit chaque mise à jour. */
  driver?: MapPoint | null;
  /** Trace GPS déjà parcourue (l'itinéraire réel du livreur). */
  trail?: MapPoint[];
  /** Trace l'itinéraire routier (Mapbox Directions, repli OSRM). */
  showRoute?: boolean;
  /**
   * Vers quoi tracer l'itinéraire. Le livreur qui va chercher la commande vise
   * le restaurant ; tout le reste vise l'adresse de livraison.
   */
  routeTo?: 'destination' | 'restaurant';
  /** Gestes activés (plein écran). Coupés par défaut (vignette). */
  interactive?: boolean;
  /** Vue navigation inclinée et orientée. Implique `followDriver`. */
  navigation?: boolean;
  /** Centre la carte sur le livreur à chaque mise à jour. */
  followDriver?: boolean;
  /** Hauteur de la vignette ; ignoré si `fill`. */
  height?: number;
  /** Occupe tout l'espace disponible (plein écran). */
  fill?: boolean;
  /** Tap sur la vignette (ouvre le plein écran). */
  onPress?: () => void;
  /**
   * Distance et durée routières réelles, à chaque recalcul d'itinéraire.
   * Bien meilleur que l'approximation « vol d'oiseau × 1,35 » : c'est l'ETA
   * qu'on affiche au client.
   */
  onRoute?: (info: MapRouteInfo) => void;
  /** Libellés des bulles. */
  labels?: { restaurant?: string; destination?: string; driver?: string };
}

export function TrackingMap({
  restaurant,
  destination = null,
  driver = null,
  trail,
  showRoute = false,
  routeTo = 'destination',
  interactive = false,
  navigation = false,
  followDriver = false,
  height = 220,
  fill = false,
  onPress,
  onRoute,
  labels,
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

  // `onRoute` passe par une ref : la page n'est construite qu'une fois, et un
  // callback recréé à chaque rendu ne doit pas recharger la carte.
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  // La page n'est construite qu'une fois par jeu de points fixes : tout le
  // reste transite par postMessage sans recharger la WebView.
  const html = useMemo(
    () =>
      buildMapHtml({
        restaurant,
        destination,
        interactive,
        navigation,
        followDriver,
        showRoute,
        routeTo,
        labels,
        colors: {
          route: theme.colors.primary,
          trail: theme.colors.success,
          background: theme.colors.surfaceSunken,
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurant.latitude,
      restaurant.longitude,
      destination?.latitude,
      destination?.longitude,
      interactive,
      navigation,
      followDriver,
      showRoute,
      routeTo,
    ],
  );

  const send = useCallback((payload: object) => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  }, []);

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
    const { trail: pastTrail, driver: currentDriver } = latest.current;
    if (pastTrail && pastTrail.length > 0) send({ type: 'trail', points: pastTrail });
    if (currentDriver) {
      send({ type: 'driver', latitude: currentDriver.latitude, longitude: currentDriver.longitude });
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string } & MapRouteInfo;
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
        // baseUrl explicite : sans lui la page est servie depuis `about:blank`,
        // dont l'origine nulle empêche Mapbox GL de démarrer ses web workers
        // (blob:) sur certaines WebView Android. C'est aussi l'origine à
        // autoriser si vous restreignez le jeton par URL.
        source={{ html, baseUrl: 'https://istanbul.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowsBackForwardNavigationGestures={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
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
