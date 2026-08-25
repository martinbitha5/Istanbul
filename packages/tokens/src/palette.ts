/**
 * Palette brute — valeurs primitives uniquement.
 *
 * Aucun composant ne doit importer ce fichier directement : passez par les
 * tokens sémantiques de `theme.ts`. Une couleur codée en dur dans un écran est
 * une régression, pas un raccourci.
 *
 * Provenance des valeurs : relevées sur Uber Eats, pas approximées à l'œil.
 * Les pages web sauvegardées ont donné les hex exacts (voir
 * `apps/admin/src/app/store.css`, qui porte les mêmes tokens côté vitrine) ;
 * les captures iOS ont donné les usages. Le mobile et la vitrine partagent
 * donc littéralement la même palette.
 */

/**
 * Encre — le noir de marque et ses gris.
 *
 * Uber n'a pas de « couleur primaire » au sens habituel : le noir tient ce
 * rôle, pour le texte comme pour les boutons. Les gris sont neutres, pas
 * réchauffés — c'est ce qui donne le rendu clinique et net de l'application.
 */
export const ink = {
  0: '#FFFFFF',
  /** Fond des champs de recherche et des puces au repos. */
  50: '#F3F3F3',
  /** Boutons secondaires, puces sélectionnées, survols. */
  100: '#E8E8E8',
  /** Bordures discrètes — séparateurs de liste. */
  150: '#EEEEEE',
  /** Bordure standard. */
  200: '#E2E2E2',
  300: '#CBCBCB',
  /** Texte désactivé. */
  400: '#AFAFAF',
  /** Texte tertiaire — méta, légendes. */
  500: '#757575',
  /** Texte secondaire — descriptions. */
  600: '#545454',
  700: '#333333',
  /** Bleu-nuit d'Uber, pour les fonds sombres ponctuels. */
  800: '#142328',
  900: '#0A0A0A',
  950: '#000000',
} as const;

/**
 * Vert — le signal positif, et rien d'autre.
 *
 * `500` est le vert de marque exact. Il ne sert JAMAIS de fond de bouton :
 * chez Uber le bouton primaire est noir, et le vert reste un signal (livraison
 * confirmée, prix promotionnel, pastille de panier).
 *
 * `600` existe parce que `500` sous du texte blanc ne donne que 2.3:1. Les
 * badges pleins et le texte vert sur blanc prennent donc le 600 (5.0:1) — à
 * l'œil c'est le même vert, et ça se lit.
 */
export const green = {
  50: '#E6F8EE',
  300: '#4ADE95',
  500: '#06C167',
  600: '#058040',
  700: '#03642F',
} as const;

/**
 * Rouge — Uber One, promotions, erreurs.
 *
 * Le même rouge sert la promotion et l'erreur chez Uber. On garde cette
 * économie : un rouge de plus n'apporterait rien qu'une couleur à arbitrer.
 */
export const red = {
  50: '#FDE7E4',
  300: '#F5877A',
  500: '#E11900',
  600: '#B31400',
  700: '#8C1000',
} as const;

/** Ambre — avertissements doux (« l'adresse semble éloignée »). */
export const amber = {
  50: '#FDF2D6',
  300: '#E8B54D',
  500: '#B26B00',
  600: '#8F5500',
  700: '#7A4A00',
} as const;

/** Bleu — information et nouveautés. C'est le bleu des badges « NOUVEAUTÉ ». */
export const blue = {
  50: '#E8F0FE',
  300: '#7FA8F7',
  500: '#276EF1',
  600: '#1A4FB4',
  700: '#143C89',
} as const;

export type ColorRamp = Record<number, string>;
