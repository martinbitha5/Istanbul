import Link from 'next/link';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreFooter } from '@/components/store/StoreFooter';
import { getStorefront } from '@/lib/storefront';

/**
 * Crédits photos.
 *
 * Les visuels livrés avec la vitrine viennent d'Openverse (Creative Commons).
 * La grande majorité est en CC0 ou domaine public : rien n'est dû. Cinq
 * photos, en revanche, sont sous licence CC BY ou CC BY-SA, qui **exige** le
 * nom de l'auteur, la licence et un lien vers l'original. Cette page est cette
 * mention — sans elle, l'usage commercial de ces cinq images est en défaut.
 *
 * Quand le gérant remplace une photo par la sienne depuis le backoffice, la
 * ligne correspondante n'a plus lieu d'être : c'est écrit en haut de page,
 * parce que personne ne pense à revenir dans un fichier de crédits.
 *
 * La carte a ses propres obligations (OpenStreetMap et CARTO), portées par
 * l'attribution affichée dans le coin de la carte elle-même. Elles sont
 * rappelées ici pour être trouvables.
 */

interface Credit {
  /** Ce que la photo illustre sur la vitrine. */
  usage: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

const CREDITS: Credit[] = [
  {
    usage: 'Catégorie « Desserts »',
    author: 'alixanaeuphoria',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    source: 'https://www.flickr.com/photos/35711875@N00/1981290798',
  },
  {
    usage: 'Shawarma Bœuf',
    author: 'fugzu',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://www.flickr.com/photos/70253321@N00/5682840223',
  },
  {
    usage: 'Sandwich Kefta',
    author: 'noii’s',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    source: 'https://www.flickr.com/photos/17306001@N00/3063262273',
  },
  {
    usage: 'Onion rings',
    author: 'ultrakml',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://www.flickr.com/photos/34948727@N00/6884868096',
  },
  {
    usage: 'Künefe',
    author: 'Sudharsan Narayanan',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://www.flickr.com/photos/42119274@N08/8031644882',
  },
];

export const metadata = {
  title: 'Crédits photos — Istanbul Fast Food',
};

export default async function CreditsPage() {
  const storefront = await getStorefront();

  return (
    <>
      <StoreHeader variant="landing" />

      <main className="ue-container py-16">
        <h1 className="ue-h1">Crédits photos</h1>
        <p className="mt-4 max-w-[62ch] text-base text-[var(--ue-ink-secondary)]">
          Les photos livrées avec le site proviennent d’Openverse. La plupart sont en CC0 ou
          dans le domaine public et ne demandent aucune mention. Les cinq ci-dessous sont sous
          licence Creative Commons avec attribution : leur auteur doit être cité tant qu’elles
          sont affichées. Une photo remplacée depuis l’espace restaurant sort de cette liste.
        </p>

        <ul className="mt-10 divide-y divide-[var(--ue-border-subtle)]">
          {CREDITS.map((credit) => (
            <li key={credit.usage} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-4">
              <span className="text-base font-medium">{credit.usage}</span>
              <span className="text-base text-[var(--ue-ink-secondary)]">
                photo de {credit.author} —{' '}
                <a
                  href={credit.source}
                  className="underline underline-offset-2"
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  original
                </a>{' '}
                sous{' '}
                <a
                  href={credit.licenseUrl}
                  className="underline underline-offset-2"
                  rel="noopener noreferrer nofollow license"
                  target="_blank"
                >
                  {credit.license}
                </a>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="ue-h2 mt-14">Cartographie</h2>
        <p className="mt-3 max-w-[62ch] text-base text-[var(--ue-ink-secondary)]">
          Les cartes de Kinshasa affichent des données{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline underline-offset-2"
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            OpenStreetMap
          </a>{' '}
          (ODbL) sur des fonds{' '}
          <a
            href="https://carto.com/attributions"
            className="underline underline-offset-2"
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            CARTO
          </a>
          . La recherche d’adresse et le géocodage inversé utilisent Nominatim, service
          d’OpenStreetMap.
        </p>

        <Link href="/" className="ue-btn ue-btn-secondary mt-12">
          Retour à l’accueil
        </Link>
      </main>

      <StoreFooter
        phone={storefront?.restaurant.phone}
        city={storefront?.restaurant.city}
      />
    </>
  );
}
