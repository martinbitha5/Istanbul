/**
 * Coordonnées du restaurant.
 *
 * Centralisées ici parce qu'elles étaient dupliquées en dur dans
 * `app/delivery/[id].tsx` et `app/(tabs)/profile.tsx` — deux sources de
 * vérité qui finissent toujours par diverger.
 *
 * TODO(données) : ces valeurs devraient venir de la table `restaurants`, que
 * le client et le dashboard lisent déjà — une adresse corrigée au dashboard ne
 * se propage pas ici. La constante n'est pas un choix d'architecture, c'est
 * une dette : elle tient parce qu'Istanbul ne déménage pas souvent.
 */
export const RESTAURANT = {
  name: 'Istanbul Fast Food',
  address: 'Avenue Delvaux n°42, Ngaliema',
  phone: '+243999000111',
  phoneDisplay: '+243 999 000 111',
  coords: { latitude: -4.3735, longitude: 15.2662 },
} as const;
