/**
 * Coordonnées du restaurant.
 *
 * Centralisées ici parce qu'elles étaient dupliquées en dur dans
 * `app/delivery/[id].tsx` et `app/(tabs)/profile.tsx` — deux sources de
 * vérité qui finissent toujours par diverger.
 *
 * TODO(données) : ces valeurs devraient venir de la table `restaurants`
 * (le client et l'admin la lisent déjà). Tant que l'app livreur est
 * mono-restaurant, la constante suffit, mais toute évolution multi-sites
 * passera par un fetch au démarrage.
 */
export const RESTAURANT = {
  name: 'Istanbul Fast Food',
  address: 'Avenue Delvaux n°42, Ngaliema',
  phone: '+243999000111',
  phoneDisplay: '+243 999 000 111',
  coords: { latitude: -4.3735, longitude: 15.2662 },
} as const;
