'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Minus, Plus, X } from '@phosphor-icons/react';
import {
  defaultSelection,
  formatMoney,
  productPriceWithOptions,
  toggleOption,
  useCartStore,
  useProduct,
  validateOptionSelection,
} from '@istanbul/core';
import type { ProductOptionGroup } from '@istanbul/types';
import { StoreModal } from '@/components/store/StoreModal';

/**
 * Fiche produit en modale — la « quick view » d'Uber Eats.
 *
 * Anatomie reprise de la page KFC : visuel carré à gauche, tout le détail à
 * droite, et le bouton d'ajout collé en bas, toujours visible pendant qu'on
 * fait défiler les sauces. Le prix qu'il affiche est le prix réel, options et
 * quantité comprises — sur l'original aussi, et c'est ce qui évite la
 * mauvaise surprise au panier.
 *
 * Les règles de choix ne sont pas réécrites ici : `toggleOption`,
 * `defaultSelection` et `validateOptionSelection` viennent de
 * `@istanbul/core` et sont les mêmes que celles de l'application mobile. Un
 * groupe SINGLE obligatoire ne peut donc pas être vidé, et un groupe MULTIPLE
 * refuse silencieusement au-delà de son plafond, exactement comme sur mobile.
 */
export function ProductModal({
  productId,
  currency,
  onClose,
}: {
  productId: string | null;
  currency: string;
  onClose: () => void;
}) {
  const { data: product, isLoading, error } = useProduct(productId);
  const addLine = useCartStore((state) => state.addLine);

  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const groups = useMemo<ProductOptionGroup[]>(() => product?.option_groups ?? [], [product]);

  // Réinitialisation à chaque produit : rouvrir une fiche avec les options de
  // la précédente est le genre de bug qu'on ne voit qu'en production, dans une
  // commande qui part avec la mauvaise sauce.
  useEffect(() => {
    if (!product) return;
    setSelected(defaultSelection(product.option_groups ?? []));
    setQuantity(1);
    setNote('');
    setShowErrors(false);
  }, [product]);

  const errors = validateOptionSelection(groups, selected);
  const total = product ? productPriceWithOptions(product, groups, selected, quantity) : 0;

  const submit = () => {
    if (!product) return;
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }

    addLine(product, selected, quantity, note.trim() || null);
    onClose();
  };

  return (
    <StoreModal
      open={productId !== null}
      onClose={onClose}
      label={product?.name ?? 'Fiche produit'}
      width="max-w-[1200px]"
    >
      {/* Barre de fermeture, hors zone de défilement : sur une fiche longue
          (dix sauces au choix), une croix qui part avec le contenu oblige à
          remonter pour sortir. */}
      <div className="flex shrink-0 items-center justify-between p-4">
        <button type="button" onClick={onClose} className="ue-close" aria-label="Fermer">
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6">
        {isLoading ? (
          <ProductSkeleton />
        ) : error || !product ? (
          <p className="py-16 text-center text-base text-[var(--ue-ink-secondary)]">
            Ce plat n’a pas pu être chargé. Réessayez dans un instant.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--ue-radius)]">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 92vw, 560px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="ue-skeleton absolute inset-0" aria-hidden />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="ue-h1">{product.name}</h2>

              <p className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-bold">
                  {formatMoney(product.base_price, currency)}
                </span>
                {product.compare_at_price !== null &&
                product.compare_at_price > product.base_price ? (
                  <span className="text-base text-[var(--ue-ink-tertiary)] line-through">
                    {formatMoney(product.compare_at_price, currency)}
                  </span>
                ) : null}
              </p>

              {product.description ? (
                <p className="mt-4 whitespace-pre-line text-base leading-6 text-[var(--ue-ink-secondary)]">
                  {product.description}
                </p>
              ) : null}

              {!product.is_available ? (
                <p
                  className="mt-4 rounded-[var(--ue-radius)] px-4 py-3 text-base font-medium"
                  style={{ background: 'var(--ue-surface-sunken)' }}
                >
                  Ce plat est épuisé pour le moment.
                </p>
              ) : null}

              {groups.map((group) => {
                const groupError = showErrors
                  ? errors.find((candidate) => candidate.groupId === group.id)
                  : undefined;

                return (
                  <fieldset key={group.id} className="mt-8">
                    <legend className="ue-h3">{group.name}</legend>
                    <p className="mt-1 text-sm text-[var(--ue-ink-secondary)]">
                      {optionHint(group)}
                    </p>
                    {groupError ? (
                      <p
                        className="mt-2 text-sm font-medium"
                        style={{ color: 'var(--ue-promo)' }}
                      >
                        {groupError.message}
                      </p>
                    ) : null}

                    <div className="mt-2">
                      {group.options.map((option) => {
                        const checked = selected.includes(option.id);

                        return (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-center gap-4 border-b border-[var(--ue-border-subtle)] py-4 last:border-b-0"
                            style={{ opacity: option.is_available ? 1 : 0.4 }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-base">{option.name}</span>
                              {option.price_delta !== 0 ? (
                                <span className="block text-sm text-[var(--ue-ink-secondary)]">
                                  {option.price_delta > 0 ? '+' : ''}
                                  {formatMoney(option.price_delta, currency)}
                                </span>
                              ) : null}
                            </span>

                            <input
                              type={group.selection_type === 'SINGLE' ? 'radio' : 'checkbox'}
                              name={group.id}
                              checked={checked}
                              disabled={!option.is_available}
                              onChange={() => {
                                setSelected((current) =>
                                  toggleOption(group, current, option.id),
                                );
                                setShowErrors(false);
                              }}
                              className="sr-only"
                            />

                            {/* Coche dessinée : la case native ne sait pas
                                prendre le noir de marque de façon fiable d'un
                                navigateur à l'autre. */}
                            <span
                              aria-hidden
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border"
                              style={{
                                borderColor: checked ? 'var(--ue-ink)' : 'var(--ue-border)',
                                background: checked ? 'var(--ue-ink)' : 'transparent',
                                color: 'var(--ue-ink-inverse)',
                              }}
                            >
                              {checked ? <Check size={14} weight="bold" /> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              <div className="mt-8">
                <label className="ue-h3" htmlFor="product-note">
                  Une précision pour la cuisine ?
                </label>
                <input
                  id="product-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={140}
                  placeholder="Sans oignons, bien cuit…"
                  className="ue-field mt-2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {product ? (
        <div className="shrink-0 border-t border-[var(--ue-border-subtle)] bg-[var(--ue-surface)] p-4 md:px-6">
          <div className="flex items-center gap-4">
            <div
              className="flex shrink-0 items-center gap-1 rounded-[var(--ue-pill)] p-1"
              style={{ background: 'var(--ue-surface-sunken)' }}
            >
              <QuantityButton
                label="Retirer un article"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
              >
                <Minus size={16} weight="bold" aria-hidden />
              </QuantityButton>
              <span className="w-8 text-center text-base font-medium tabular-nums">
                {quantity}
              </span>
              <QuantityButton
                label="Ajouter un article"
                onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              >
                <Plus size={16} weight="bold" aria-hidden />
              </QuantityButton>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!product.is_available}
              className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg"
            >
              {product.is_available
                ? `Ajouter ${quantity} à la commande • ${formatMoney(total, currency)}`
                : 'Épuisé'}
            </button>
          </div>
        </div>
      ) : null}
    </StoreModal>
  );
}

/** « Choisissez-en 2 max. » — la ligne d'aide sous chaque groupe. */
function optionHint(group: ProductOptionGroup): string {
  if (group.selection_type === 'SINGLE') {
    return group.is_required ? 'Obligatoire · un choix' : 'Facultatif · un choix';
  }
  if (group.is_required) {
    return `Obligatoire · ${group.min_select} minimum, ${group.max_select} maximum`;
  }
  return `Facultatif · choisissez-en ${group.max_select} max.`;
}

function QuantityButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-10">
      <div className="ue-skeleton aspect-square w-full rounded-[var(--ue-radius)]" aria-hidden />
      <div className="space-y-4" aria-hidden>
        <div className="ue-skeleton h-9 w-2/3 rounded" />
        <div className="ue-skeleton h-6 w-24 rounded" />
        <div className="ue-skeleton h-20 w-full rounded" />
      </div>
      <span className="sr-only">Chargement du plat…</span>
    </div>
  );
}
