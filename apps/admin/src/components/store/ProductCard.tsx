'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, Star } from '@phosphor-icons/react';
import { formatMoney, type Product } from '@istanbul/core';

/**
 * Carte produit, transposée de la carte restaurant d'Uber Eats.
 *
 * Leur anatomie, reprise à l'identique : visuel 16:9 à rayon 8, cœur en
 * pastille blanche posé en haut à droite, badge d'offre en haut à gauche,
 * puis nom en gras 16/24 et une ligne d'attributs en 14/20 gris — note,
 * nombre d'avis, délai.
 *
 * Différence assumée : Uber affiche « 4.5 (2,000+) » sur toutes ses cartes.
 * Ici la note vient de `rating_sum / rating_count` ; un plat sans avis
 * n'affiche pas de note plutôt qu'une note inventée.
 */
export function ProductCard({
  product,
  currency,
  promoLabel,
  onOpen,
}: {
  product: Product;
  currency: string;
  promoLabel?: string | null;
  onOpen: () => void;
}) {
  const [liked, setLiked] = useState(false);

  const rating = product.rating_count > 0 ? product.rating_sum / product.rating_count : null;
  const discounted =
    product.compare_at_price !== null && product.compare_at_price > product.base_price;

  return (
    <article className="group relative">
      <div className="relative overflow-hidden rounded-[var(--ue-radius)]">
        <div className="relative aspect-[16/9] w-full">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt=""
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="ue-skeleton absolute inset-0" aria-hidden />
          )}
        </div>

        {promoLabel ? (
          <span
            className="absolute left-3 top-3 rounded-[var(--ue-pill)] px-3 py-1 text-sm font-medium text-[var(--ue-ink-inverse)]"
            style={{ background: 'var(--ue-green)' }}
          >
            {promoLabel}
          </span>
        ) : null}

        {!product.is_available ? (
          <span
            className="absolute left-3 top-3 rounded-[var(--ue-pill)] px-3 py-1 text-sm font-medium"
            style={{ background: 'var(--ue-surface)', color: 'var(--ue-ink-secondary)' }}
          >
            Épuisé
          </span>
        ) : null}

        {/* `z-10` : le cœur est posé au-dessus du lien étendu du titre,
            sinon un clic dessus ouvrirait la fiche produit. */}
        <button
          type="button"
          onClick={() => setLiked((value) => !value)}
          aria-pressed={liked}
          aria-label={liked ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)]"
          style={{ boxShadow: 'var(--ue-shadow-card)' }}
        >
          <Heart size={18} weight={liked ? 'fill' : 'regular'} aria-hidden />
        </button>
      </div>

      {/* Toute la carte ouvre la fiche, mais un seul élément est annoncé :
          le titre porte le bouton, étendu à la carte par un ::before absolu. */}
      <h3 className="mt-3 text-base font-bold leading-6">
        <button type="button" onClick={onOpen} className="text-left">
          <span className="absolute inset-0" aria-hidden />
          {product.name}
        </button>
      </h3>

      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm leading-5 text-[var(--ue-ink-secondary)]">
        {rating !== null ? (
          <>
            <span className="font-medium text-[var(--ue-ink)]">
              {rating.toFixed(1).replace('.', ',')}
            </span>
            <Star size={12} weight="fill" aria-hidden className="text-[var(--ue-ink)]" />
            <span>({product.rating_count})</span>
            <span aria-hidden>•</span>
          </>
        ) : null}
        <span>{product.prep_minutes} min</span>
      </p>

      <p className="mt-0.5 flex items-baseline gap-2 text-sm leading-5">
        <span className="font-medium">{formatMoney(product.base_price, currency)}</span>
        {discounted ? (
          <span className="text-[var(--ue-ink-tertiary)] line-through">
            {formatMoney(product.compare_at_price!, currency)}
          </span>
        ) : null}
      </p>
    </article>
  );
}
