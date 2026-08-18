/**
 * Palette brute — valeurs primitives uniquement.
 *
 * Aucun composant ne doit importer ce fichier directement : passez par les
 * tokens sémantiques de `theme.ts`. Une couleur codée en dur dans un écran est
 * une régression, pas un raccourci.
 */

/** Braise — la couleur de marque. Le rouge du grill au charbon. */
export const ember = {
  50: '#FFF3EF',
  100: '#FFE1D6',
  200: '#FFC0AC',
  300: '#FF9877',
  400: '#F76B45',
  500: '#E5431C',
  600: '#C4320F',
  700: '#9E260B',
  800: '#7A1F0B',
  900: '#5A1A0B',
} as const;

/** Safran — accent chaud : promotions, notes, badges. */
export const saffron = {
  50: '#FFF8E8',
  100: '#FDECC4',
  200: '#FADD93',
  300: '#F4C95D',
  400: '#EBB43A',
  500: '#D99B22',
  600: '#B27714',
  700: '#8B5B12',
  800: '#6B4711',
  900: '#4E3410',
} as const;

/**
 * Encre — neutres désaturés vers le chaud.
 * Un gris bleuté à côté d'une photo de nourriture donne un rendu clinique.
 */
export const ink = {
  0: '#FFFFFF',
  25: '#FFFBF7',
  50: '#FBF6F1',
  100: '#F3ECE5',
  200: '#E6DCD3',
  300: '#CFC3B8',
  400: '#A2958A',
  500: '#7A6E64',
  600: '#5B5149',
  700: '#403933',
  800: '#292420',
  900: '#1A1613',
  950: '#100D0B',
} as const;

/** Pistache — succès, fraîcheur, végétarien. */
export const pistachio = {
  100: '#DDF3E1',
  300: '#8ED49E',
  500: '#2F8F49',
  600: '#24713A',
  700: '#1B5A2E',
} as const;

/** Bosphore — information, cartes, états neutres actifs. */
export const bosphorus = {
  100: '#D6EEF6',
  300: '#79C8DE',
  500: '#1B7F9E',
  600: '#14657E',
  700: '#0F4E62',
} as const;

/** Rouge signal — erreurs et actions destructives. Distinct de la braise. */
export const danger = {
  100: '#FBDDDD',
  300: '#EE9A9A',
  500: '#D32F2F',
  600: '#B02424',
  700: '#8B1D1D',
} as const;

export type ColorRamp = Record<number, string>;
