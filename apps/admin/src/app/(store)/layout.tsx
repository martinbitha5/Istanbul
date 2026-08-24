/**
 * Coquille de la vitrine publique.
 *
 * `data-surface="store"` est ce qui bascule toute la sous-arborescence sur le
 * thème Uber (voir app/store.css) : noir et blanc, rayon 8, pilules, Figtree
 * en titres. Le backoffice, sous /admin, garde son thème Wise sans qu'aucun
 * sélecteur ne se chevauche.
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
