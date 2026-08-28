import { getStorefront } from '@/lib/storefront';
import { StoreCartProvider } from '@/components/store/StoreCart';

/**
 * Coquille de la vitrine publique.
 *
 * `data-surface="store"` active les composants de la vitrine (`.ue-btn`,
 * `.ue-chip`, l'échelle typographique…) et fixe le fond clair : Uber Eats n'a
 * pas de mode sombre, la vitrine reste claire même chez un visiteur en
 * préférence sombre. Voir app/store.css.
 *
 * La *palette* elle-même n'est pas portée par cet attribut : elle vit sur
 * `:root` et sert aussi au backoffice, qui partage désormais la même charte
 * avec ses propres primitives (components/ui.tsx).
 *
 * Le panier est monté ici, et non page par page : le compteur de l'entête est
 * visible partout, il faut donc que le tiroir puisse s'ouvrir partout. Voir
 * components/store/StoreCart.tsx.
 *
 * `getStorefront` est mémoïsé par requête (`cache()`), cet appel ne coûte donc
 * rien aux pages qui le font déjà. Seuls l'établissement et les prix barrés
 * traversent vers le client — pas le catalogue entier, qui pèserait pour rien
 * sur les pages qui n'affichent pas de plats.
 *
 * Pas de garde d'authentification ici, et c'est volontaire : le catalogue est
 * lisible par le rôle `anon` (policies `*_read_all`), et le middleware ne
 * couvre plus que /admin.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const storefront = await getStorefront();

  return (
    <div data-surface="store" className="min-h-dvh">
      <StoreCartProvider
        restaurant={storefront?.restaurant ?? null}
        products={(storefront?.products ?? []).map((product) => ({
          id: product.id,
          compare_at_price: product.compare_at_price,
        }))}
      >
        {children}
      </StoreCartProvider>
    </div>
  );
}
