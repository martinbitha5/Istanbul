import { config } from '@/lib/config';

/**
 * Le restaurant.
 *
 * Istanbul Fast Food est le seul établissement de l'application. L'identifiant
 * reste une variable d'environnement plutôt qu'une constante en dur pour que
 * l'app de développement pointe sur la base locale et celle du store sur la
 * production, mais il n'y a jamais qu'une valeur à la fois.
 *
 * Ce fichier remplace l'ancien `store/restaurant.ts`, un store Zustand
 * persisté qui mémorisait « le restaurant choisi » : il lisait AsyncStorage au
 * démarrage, vidait le panier au changement, et alimentait un sélecteur qui ne
 * s'affichait jamais. Une constante suffit — et l'app démarre sans attendre
 * une lecture de disque.
 */
export const RESTAURANT_ID = config.restaurantId;
