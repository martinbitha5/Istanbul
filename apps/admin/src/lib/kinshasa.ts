/**
 * Les 24 communes de Kinshasa, avec leurs coordonnées.
 *
 * Relevées une fois sur Nominatim (OpenStreetMap) et figées ici. Deux raisons
 * de ne pas les demander au moment du rendu : la politique d'usage de
 * Nominatim n'autorise pas une requête par étiquette de carte, et une vitrine
 * qui n'affiche plus ses zones parce qu'un service tiers répond lentement est
 * une vitrine cassée. Ces points ne bougeront pas.
 *
 * Ce sont des **centres approximatifs**, pas des limites administratives : ils
 * servent à poser une étiquette et à centrer la carte, jamais à décider d'un
 * tarif. La distance qui facture est calculée par `fn_delivery_quote`, à
 * partir des coordonnées réelles de l'adresse du client.
 */

import type { GeoPoint } from '@/lib/geocode';

export interface Commune extends GeoPoint {
  name: string;
  /** Les communes du centre, étiquetées dès le zoom d'ensemble. */
  major?: boolean;
}

export const KINSHASA_COMMUNES: Commune[] = [
  { name: 'Bandalungwa', lat: -4.34222, lng: 15.28316 },
  { name: 'Barumbu', lat: -4.31901, lng: 15.32569 },
  { name: 'Bumbu', lat: -4.37259, lng: 15.29344 },
  { name: 'Gombe', lat: -4.31198, lng: 15.28943, major: true },
  { name: 'Kalamu', lat: -4.34956, lng: 15.31793 },
  { name: 'Kasa-Vubu', lat: -4.34172, lng: 15.30402 },
  { name: 'Kimbanseke', lat: -4.44171, lng: 15.40354, major: true },
  { name: 'Kinshasa', lat: -4.32171, lng: 15.31225 },
  { name: 'Kintambo', lat: -4.34343, lng: 15.26675 },
  { name: 'Kisenso', lat: -4.41766, lng: 15.34166 },
  { name: 'Lemba', lat: -4.40397, lng: 15.31734, major: true },
  { name: 'Limete', lat: -4.35435, lng: 15.34669, major: true },
  { name: 'Lingwala', lat: -4.32525, lng: 15.30126 },
  { name: 'Makala', lat: -4.38296, lng: 15.30855 },
  { name: 'Maluku', lat: -4.05489, lng: 15.56121, major: true },
  { name: 'Masina', lat: -4.36617, lng: 15.39098, major: true },
  { name: 'Matete', lat: -4.38896, lng: 15.35125 },
  { name: 'Mont-Ngafula', lat: -4.49499, lng: 15.26773, major: true },
  { name: 'N’Djili', lat: -4.40672, lng: 15.37538 },
  { name: 'Ngaba', lat: -4.38132, lng: 15.32181 },
  { name: 'Ngaliema', lat: -4.37547, lng: 15.24736, major: true },
  { name: 'Ngiri-Ngiri', lat: -4.35689, lng: 15.29869 },
  { name: 'Nsele', lat: -4.32083, lng: 15.51406, major: true },
  { name: 'Selembao', lat: -4.40096, lng: 15.28524 },
];

/** Les noms seuls, pour l'aide à la saisie (`datalist`). */
export const COMMUNE_NAMES = KINSHASA_COMMUNES.map((commune) => commune.name);
