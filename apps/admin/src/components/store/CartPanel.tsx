'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Minus, Plus, Trash, X } from '@phosphor-icons/react';
import {
  formatMoney,
  lineTotal,
  selectItemCount,
  selectSubtotal,
  summarizeOptions,
  useCartStore,
  useSession,
} from '@istanbul/core';
import type { Product, Restaurant } from '@istanbul/types';
import { StoreModal } from '@/components/store/StoreModal';
import { useDeliveryPrefs } from '@/lib/delivery-prefs';

/**
 * Le panier en tiroir, à droite — celui d'Uber Eats.
 *
 * Point important du parcours demandé : **on peut le remplir sans compte**.
 * Le panier vit dans `useCartStore` (zustand persisté), l'adresse dans
 * `delivery-prefs` ; ni l'un ni l'autre ne touche le serveur. La connexion
 * n'est réclamée qu'au clic sur « Commander », et l'URL de retour est passée
 * en `next` pour que le client retrouve son panier intact juste après.
 */
export function CartPanel({
  open,
  onClose,
  restaurant,
  products,
}: {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  /** Le catalogue, seulement pour retrouver les prix barrés (voir `savings`). */
  products: Pick<Product, 'id' | 'compare_at_price'>[];
}) {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const prefs = useDeliveryPrefs();

  const lines = useCartStore((state) => state.lines);
  const subtotal = useCartStore(selectSubtotal);
  const itemCount = useCartStore(selectItemCount);
  const increment = useCartStore((state) => state.incrementLine);
  const decrement = useCartStore((state) => state.decrementLine);
  const removeLine = useCartStore((state) => state.removeLine);

  const currency = restaurant.currency;

  /**
   * Économie réalisée : écart entre prix barré et prix payé, ligne par ligne.
   *
   * Le calcul a besoin du catalogue : `CartLine` ne retient que le prix
   * effectivement payé (`unit_price`), et c'est volontaire — un panier
   * persisté depuis hier ne doit pas ressusciter la promo d'hier. On relit
   * donc le `compare_at_price` courant, et une promo terminée fait
   * simplement disparaître le bandeau.
   */
  const savings = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));

    return lines.reduce((sum, line) => {
      const product = byId.get(line.product_id);
      if (!product?.compare_at_price) return sum;

      const delta = product.compare_at_price - line.unit_price;
      return delta > 0 ? sum + delta * line.quantity : sum;
    }, 0);
  }, [lines, products]);

  const checkout = () => {
    // La session met un instant à se résoudre au premier rendu. Router sur
    // `!session` pendant ce laps enverrait un client déjà connecté sur la
    // page de connexion : le bouton est donc inerte tant qu'on ne sait pas.
    if (sessionLoading) return;

    onClose();

    if (!session) {
      // Le parcours demandé : la page de connexion s'intercale ici, et le
      // client revient à la commande une fois identifié.
      router.push(`/connexion?next=${encodeURIComponent('/commande')}`);
      return;
    }

    router.push('/commande');
  };

  return (
    <StoreModal
      open={open}
      onClose={onClose}
      label="Votre panier"
      placement="right"
      width="max-w-[540px]"
    >
      <div className="flex shrink-0 items-center justify-between p-4">
        <button type="button" onClick={onClose} className="ue-close" aria-label="Fermer le panier">
          <X size={20} aria-hidden />
        </button>
        <span className="text-sm text-[var(--ue-ink-secondary)]">
          {itemCount > 0 ? `${itemCount} article${itemCount > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* px-4 au téléphone : à 375 px, deux gouttières de 24 amputaient la
          ligne d'un plat de 48 px, soit la moitié de sa vignette. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 pb-6">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-base font-extrabold"
            style={{
              background: 'var(--ue-surface-sunken)',
              backgroundImage: restaurant.logo_url ? `url(${restaurant.logo_url})` : undefined,
              backgroundSize: 'cover',
              fontFamily: 'var(--ue-font-display)',
            }}
          >
            {restaurant.logo_url ? null : 'IF'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-6">{restaurant.name}</p>
            <p className="truncate text-sm text-[var(--ue-ink-secondary)]">
              {prefs.mode === 'pickup'
                ? `À emporter — ${restaurant.address_line}`
                : (prefs.address ?? restaurant.address_line)}
            </p>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="border-t border-[var(--ue-border-subtle)] py-16 text-center">
            <p className="ue-h3">Votre panier est vide</p>
            <p className="mt-2 text-base text-[var(--ue-ink-secondary)]">
              Ajoutez un plat depuis la carte pour commencer.
            </p>
          </div>
        ) : (
          <ul className="border-t border-[var(--ue-border-subtle)]">
            {lines.map((line) => (
              <li
                key={line.key}
                className="flex gap-4 border-b border-[var(--ue-border-subtle)] py-4"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--ue-radius)]">
                  {line.product_image ? (
                    <Image
                      src={line.product_image}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="ue-skeleton absolute inset-0" aria-hidden />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium leading-6">{line.product_name}</p>
                  {line.options.length > 0 ? (
                    <p className="mt-0.5 truncate text-sm text-[var(--ue-ink-secondary)]">
                      {summarizeOptions(line.options)}
                    </p>
                  ) : null}
                  {line.note ? (
                    <p className="mt-0.5 truncate text-sm italic text-[var(--ue-ink-secondary)]">
                      « {line.note} »
                    </p>
                  ) : null}
                  <p className="mt-1 text-base font-medium">
                    {formatMoney(lineTotal(line), currency)}
                  </p>
                </div>

                <div
                  className="flex h-9 shrink-0 items-center gap-1 self-start rounded-[var(--ue-pill)] p-1"
                  style={{ background: 'var(--ue-surface-sunken)' }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      line.quantity <= 1 ? removeLine(line.key) : decrement(line.key)
                    }
                    aria-label={
                      line.quantity <= 1
                        ? `Retirer ${line.product_name} du panier`
                        : `Retirer un ${line.product_name}`
                    }
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)]"
                  >
                    {line.quantity <= 1 ? (
                      <Trash size={14} aria-hidden />
                    ) : (
                      <Minus size={14} weight="bold" aria-hidden />
                    )}
                  </button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => increment(line.key)}
                    aria-label={`Ajouter un ${line.product_name}`}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)]"
                  >
                    <Plus size={14} weight="bold" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="shrink-0 border-t border-[var(--ue-border-subtle)]"
        // Le tiroir occupe tout l'écran au téléphone : sans ce retrait, le
        // bouton « Commander » tombe sous la barre de gestes de l'iPhone.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-baseline justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold">Sous-total</span>
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(subtotal, currency)}
          </span>
        </div>

        {savings > 0 ? (
          <p
            className="px-4 py-3 text-base font-medium sm:px-6"
            style={{ background: 'var(--ue-promo)', color: 'var(--ue-ink-inverse)' }}
          >
            Vous économisez {formatMoney(savings, currency)} avec les promotions
          </p>
        ) : null}

        <div className="p-4 pt-4 sm:p-6 sm:pt-4">
          <button
            type="button"
            onClick={checkout}
            disabled={lines.length === 0 || sessionLoading}
            className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg"
          >
            Commander
          </button>

          {!sessionLoading && !session && lines.length > 0 ? (
            <p className="mt-3 text-center text-sm text-[var(--ue-ink-secondary)]">
              La connexion vous sera demandée à l’étape suivante. Votre panier est conservé.
            </p>
          ) : null}
        </div>
      </div>
    </StoreModal>
  );
}
