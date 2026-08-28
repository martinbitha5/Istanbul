'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShoppingCart } from '@phosphor-icons/react';
import { formatMoney, selectItemCount, selectSubtotal, useCartStore } from '@istanbul/core';
import type { Product, Restaurant } from '@istanbul/types';
import { CartPanel } from '@/components/store/CartPanel';

/** Ce dont le panier a besoin du catalogue : le prix barré, rien de plus. */
export type CartCatalogEntry = Pick<Product, 'id' | 'compare_at_price'>;

/**
 * Le panier, monté une fois pour toute la vitrine.
 *
 * Il vivait dans `FeedView`, et c'était le bug : l'entête affiche le compteur
 * sur *toutes* les pages (il lit `useCartStore`, qui est persisté), mais seul
 * le feed savait ouvrir le tiroir. Sur l'accueil, la page de crédits ou la
 * commande, le bouton était donc bien là, avec le bon compte, et ne faisait
 * rien.
 *
 * Le tiroir est désormais posé par la coquille `(store)/layout.tsx` : n'importe
 * quel composant de la vitrine l'ouvre par `useStoreCart()`, et il n'y en a
 * jamais deux à l'écran.
 */
const StoreCartContext = createContext<(() => void) | null>(null);

/**
 * Ouvre le panier. Renvoie `null` hors de la vitrine (ou quand la base est
 * vierge et qu'il n'y a pas d'établissement) — l'appelant garde alors son
 * bouton inerte plutôt que de planter.
 */
export function useStoreCart() {
  return useContext(StoreCartContext);
}

export function StoreCartProvider({
  restaurant,
  products,
  children,
}: {
  restaurant: Restaurant | null;
  products: CartCatalogEntry[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const openCart = useCallback(() => setOpen(true), []);

  // La valeur ne change jamais : sans ce mémo, chaque rendu de la coquille
  // ferait re-rendre tous les consommateurs (donc chaque entête).
  const value = useMemo(() => (restaurant ? openCart : null), [restaurant, openCart]);

  return (
    <StoreCartContext.Provider value={value}>
      {children}

      {restaurant ? (
        <>
          <CartPanel
            open={open}
            onClose={close}
            restaurant={restaurant}
            products={products}
          />
          <FloatingCartBar currency={restaurant.currency} onClick={openCart} />
        </>
      ) : null}
    </StoreCartContext.Provider>
  );
}

/**
 * La barre de panier flottante du mobile.
 *
 * Au téléphone, l'entête est collante mais le pouce est en bas : tous les
 * sites de livraison posent là un rappel du panier, et c'est ce qui manquait
 * le plus une fois le tiroir réparé. Elle disparaît au-delà de 1024 px (le
 * bouton de l'entête suffit) et sur les pages où elle n'aurait aucun sens —
 * la commande, où le panier *est* la page, et la connexion.
 */
function FloatingCartBar({ currency, onClick }: { currency: string; onClick: () => void }) {
  const pathname = usePathname();
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);

  const hidden =
    itemCount === 0 || pathname === '/commande' || pathname.startsWith('/connexion');

  if (hidden) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-2 lg:hidden"
        style={{
          // Dégradé plutôt qu'un aplat : le contenu passe *sous* la barre, et
          // une coupure nette donnerait l'impression que la page s'arrête là.
          background:
            'linear-gradient(to top, var(--ue-surface) 55%, rgba(255, 255, 255, 0))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          onClick={onClick}
          className="ue-btn ue-btn-primary w-full !justify-between !px-5 !py-3.5"
          style={{ boxShadow: 'var(--ue-shadow-pop)' }}
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums"
              style={{ background: 'var(--ue-ink-inverse)', color: 'var(--ue-ink)' }}
            >
              {itemCount}
            </span>
            Voir le panier
          </span>
          <span className="flex items-center gap-2 tabular-nums">
            {formatMoney(subtotal, currency)}
            <ShoppingCart size={18} aria-hidden />
          </span>
        </button>
      </div>

      {/* La barre est `fixed` : sans cette cale, elle recouvre la dernière
          ligne de chaque page au lieu de flotter au-dessus du vide. */}
      <div aria-hidden className="h-20 lg:hidden" />
    </>
  );
}
