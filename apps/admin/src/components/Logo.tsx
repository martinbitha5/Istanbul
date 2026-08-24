import Image from 'next/image';

/**
 * Le logo de l'enseigne, partagé par la vitrine et le backoffice.
 *
 * Le fichier `public/logo.png` est le JPEG fourni par le client, détouré : son
 * fond blanc cassé est devenu transparent, mais **pas** le blanc à l'intérieur
 * de l'ovale, qui fait partie du dessin. Il se pose donc aussi bien sur le
 * blanc de la vitrine que sur l'encre de l'entête `/connexion` ou sur le fond
 * sombre du dashboard.
 *
 * Il est toujours accompagné du nom écrit en toutes lettres : à 36 px de haut,
 * le « Pide & Kebap » de l'ovale n'est plus lisible. D'où `alt=""` — le logo
 * est décoratif, le texte à côté porte l'information.
 */

/** Rapport largeur/hauteur du fichier détouré (978 × 732). */
const RATIO = 978 / 732;

export function Logo({
  height = 36,
  className = '',
  priority = false,
}: {
  height?: number;
  className?: string;
  /** À activer pour le logo de l'entête, qui est dans le premier écran. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={`shrink-0 ${className}`}
    />
  );
}
