'use client';

import {
  BeerBottle,
  BowlFood,
  BowlSteam,
  Bread,
  Cake,
  Carrot,
  Champagne,
  Cheese,
  Coffee,
  Cookie,
  CookingPot,
  Egg,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Martini,
  Orange,
  Pepper,
  Pizza,
  Popcorn,
  Shrimp,
  Wine,
} from '@phosphor-icons/react';

/**
 * Résolution de `categories.icon`, qui stocke un nom d'icône Phosphor saisi
 * dans le backoffice (« Wrap », « Hamburger », « Pizza »…).
 *
 * Table explicite plutôt qu'un `import * as Icons` : le baril de Phosphor
 * compte près de dix mille modules, et l'importer en entier annulerait
 * l'`optimizePackageImports` réglé dans next.config.mjs — plusieurs secondes
 * de compilation par page en développement, pour neuf icônes utilisées.
 *
 * Trois noms du seed n'existent pas dans la version installée (2.1.1) :
 * `Wrap`, `Sandwich` et `FrenchFries` sont arrivés plus tard. Ils sont
 * redirigés ici vers l'équivalent le plus proche au lieu de disparaître.
 */
const ICONS: Record<string, typeof ForkKnife> = {
  BeerBottle,
  BowlFood,
  BowlSteam,
  Bread,
  Cake,
  Carrot,
  Champagne,
  Cheese,
  Coffee,
  Cookie,
  CookingPot,
  Egg,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Martini,
  Orange,
  Pepper,
  Pizza,
  Popcorn,
  Shrimp,
  Wine,

  // Alias — noms absents de Phosphor 2.1.1.
  Wrap: BowlFood,
  Sandwich: Bread,
  FrenchFries: Popcorn,
  Salad: Carrot,
};

export function CategoryIcon({
  name,
  size = 22,
}: {
  name: string | null;
  size?: number;
}) {
  const Icon = (name && ICONS[name]) || ForkKnife;
  return <Icon size={size} aria-hidden />;
}
