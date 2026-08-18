/**
 * Mouvement.
 *
 * Une seule règle de rythme pour toute l'application : si une animation ne
 * pioche pas dans ces tokens, elle jure avec le reste.
 */
export const duration = {
  instant: 100,
  fast: 180,
  base: 260,
  slow: 420,
  /** Sortie plus rapide que l'entrée : ~65 %. */
  exit: 170,
} as const;

/** Courbes de Bézier pour `withTiming` (Reanimated) ou `Animated`. */
export const easing = {
  /** Entrée d'un élément à l'écran. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Sortie d'un élément. */
  in: [0.7, 0, 0.84, 0] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Rebond léger — chips, boutons. */
  emphasized: [0.2, 0, 0, 1] as const,
} as const;

/** Ressorts pour `withSpring` — préférés aux courbes pour les gestes. */
export const spring = {
  /** Feedback de pression. */
  snappy: { damping: 26, stiffness: 420, mass: 0.7 },
  /** Transitions d'écran, feuilles modales. */
  base: { damping: 18, stiffness: 220, mass: 1 },
  /** Grandes entrées (splash, hero). */
  gentle: { damping: 22, stiffness: 140, mass: 1.1 },
} as const;

/** Échelle appliquée à la pression. Jamais de translation : cela déplace le layout. */
export const pressScale = 0.97;

/** Cascade d'entrée de liste : 40 ms par élément, plafonnée à 8. */
export const stagger = {
  step: 40,
  maxItems: 8,
  delayFor: (index: number) => Math.min(index, 8) * 40,
} as const;

export type DurationToken = keyof typeof duration;
