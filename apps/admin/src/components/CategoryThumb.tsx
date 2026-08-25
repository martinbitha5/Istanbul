'use client';

import Image from 'next/image';
import type { Category } from '@istanbul/types';
import { CategoryIcon } from '@/components/store/CategoryIcon';

/**
 * La pastille d'une catégorie, telle que la vitrine l'affiche.
 *
 * Elle est reprise ici, dans la liste du backoffice, pour une raison précise :
 * le gérant doit voir *le résultat* de ce qu'il a téléversé, au même cadrage
 * rond et à la même taille que le client. Une colonne « URL de l'image »
 * remplie de texte ne dit rien de la photo qui sortira du four.
 *
 * Repli identique à celui de la vitrine : l'icône Phosphor de la catégorie
 * tant qu'aucune photo n'est chargée.
 */
export function CategoryThumb({
  category,
  size = 44,
}: {
  category: Pick<Category, 'name' | 'icon' | 'image_url'>;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{ height: size, width: size, background: 'var(--color-surface-sunken)' }}
    >
      {category.image_url ? (
        <Image
          src={category.image_url}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <CategoryIcon name={category.icon} size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}
