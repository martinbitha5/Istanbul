/**
 * Contrat de la carte, partagé par les trois applications.
 *
 * Le rendu est toujours la même page HTML : les apps mobiles la posent dans
 * une WebView, le dashboard dans une iframe. Une seule implémentation à
 * maintenir, donc une carte rigoureusement identique partout — c'est le point
 * de tout ce package.
 */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** Vers quoi l'itinéraire est calculé. */
export type RouteTarget = 'destination' | 'restaurant';

/** Couleurs injectées dans la page — reprises des tokens de l'app. */
export interface MapColors {
  /** Tracé de l'itinéraire conseillé. Noir chez Uber, noir ici. */
  route: string;
  /** Chemin réellement parcouru par le livreur. Le vert de marque. */
  trail: string;
  /** Fond visible avant le premier rendu des tuiles. */
  background: string;
}

export interface MapHtmlOptions {
  /** Jeton public Mapbox (`pk.…`). Vide → repli OpenStreetMap. */
  token: string;
  /** Le restaurant — toujours affiché. */
  restaurant: MapPoint;
  /** L'adresse de livraison, si géocodée. */
  destination?: MapPoint | null;
  /** Gestes activés (plein écran). Coupés par défaut (vignette). */
  interactive?: boolean;
  /**
   * Vue navigation : caméra inclinée, orientée dans le sens de la marche et
   * verrouillée sur le livreur. C'est la vue du livreur ; le client et le
   * dashboard gardent une vue de dessus.
   */
  navigation?: boolean;
  /** Centre la carte sur le livreur à chaque mise à jour. */
  followDriver?: boolean;
  /** Trace l'itinéraire routier (Mapbox Directions, repli OSRM). */
  showRoute?: boolean;
  /** Destination de l'itinéraire. Le livreur qui va chercher la commande vise le restaurant. */
  routeTo?: RouteTarget;
  colors: MapColors;
  labels?: {
    restaurant?: string;
    destination?: string;
    driver?: string;
  };
}

/** Ce que la page renvoie à l'hôte quand un itinéraire vient d'être calculé. */
export interface MapRouteInfo {
  /** Distance routière réelle, en kilomètres. */
  distanceKm: number;
  /** Durée estimée, en minutes, trafic compris quand Mapbox en dispose. */
  durationMin: number;
  /** `mapbox` (avec trafic), `osrm` (repli) ou `direct` (trait droit). */
  source: 'mapbox' | 'osrm' | 'direct';
}

/** Messages poussés depuis l'hôte vers la page. */
export type MapInboundMessage =
  | { type: 'driver'; latitude: number; longitude: number }
  | { type: 'trail'; points: MapPoint[] }
  | { type: 'recenter' };

/** Messages remontés par la page vers l'hôte. */
export type MapOutboundMessage =
  | { type: 'ready' }
  | ({ type: 'route' } & MapRouteInfo);
