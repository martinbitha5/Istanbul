import type { Metadata } from 'next';
import Link from 'next/link';
import { getStorefront } from '@/lib/storefront';
import { FeedView } from '@/components/store/FeedView';

export const metadata: Metadata = {
  title: 'Commander en ligne',
  description: 'Parcourez la carte, choisissez vos plats et faites-vous livrer.',
};

/**
 * Le feed, atteint après la saisie d'adresse sur l'accueil.
 *
 * Les données sont chargées côté serveur — catalogue complet en une passe —
 * et l'interactivité (filtres, recherche, tri, favoris) vit dans `FeedView`.
 * Découpage volontaire : le premier rendu contient la carte entière, donc
 * indexable et lisible sans JavaScript, et seul le tri se paie en hydratation.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [storefront, params] = await Promise.all([getStorefront(), searchParams]);

  if (!storefront) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="ue-h1">Carte indisponible</h1>
          <p className="mt-3 text-base text-[var(--ue-ink-secondary)]">
            Aucun établissement n’est enregistré en base.
          </p>
          <Link href="/" className="ue-btn ue-btn-primary mt-6">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    );
  }

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  return (
    <FeedView
      restaurant={storefront.restaurant}
      categories={storefront.categories}
      products={storefront.products}
      promotions={storefront.promotions}
      zones={storefront.zones}
      initialAddress={first(params.adresse)}
      initialCategorySlug={first(params.categorie)}
      initialFilter={first(params.filtre)}
      initialMode={first(params.mode) === 'retrait' ? 'pickup' : 'delivery'}
    />
  );
}
