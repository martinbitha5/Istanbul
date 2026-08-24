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
 * Pas de garde d'authentification ici, et c'est volontaire : le catalogue est
 * lisible par le rôle `anon` (policies `*_read_all`), et le middleware ne
 * couvre plus que /admin.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="store" className="min-h-dvh">
      {children}
    </div>
  );
}
