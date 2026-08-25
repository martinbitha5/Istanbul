import Link from 'next/link';
import { ArrowRight, Motorcycle, Storefront, Timer } from '@phosphor-icons/react/dist/ssr';
import { formatMoney } from '@istanbul/core';
import { getStorefront } from '@/lib/storefront';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreFooter } from '@/components/store/StoreFooter';
import { AddressSearch } from '@/components/store/AddressSearch';
import { KinshasaMap } from '@/components/store/KinshasaMap';
import { KINSHASA_CENTER } from '@/lib/geocode';
import { deliveryRings } from '@/lib/zones';

/**
 * Accueil de la vitrine — la page d'entrée d'Uber Eats, transposée.
 *
 * Correspondance section par section avec l'original :
 *
 *   héros photo + champ d'adresse   → identique, la photo étant la couverture
 *                                     de l'établissement
 *   trois cartes de parcours        → « Feed your employees / Your restaurant,
 *                                     delivered / Deliver with Uber Eats »
 *                                     n'ont pas de sens pour un établissement
 *                                     unique : livraison, retrait, livreurs
 *   « Cities near me »              → nos zones de livraison
 *   « Countries with Uber Eats »    → nos catégories de carte
 *
 * Rendu côté serveur : c'est la page que le client ouvre en premier et que
 * les robots indexent, elle ne doit pas commencer par un squelette.
 */
export default async function StoreHomePage() {
  const storefront = await getStorefront();

  if (!storefront) return <EmptyState />;

  const { restaurant, categories, zones } = storefront;
  const fastestZone = zones.reduce<number | null>(
    (best, zone) => (best === null || zone.eta_minutes < best ? zone.eta_minutes : best),
    null,
  );

  return (
    <>
      <StoreHeader variant="landing" />

      {/* --- Héros ------------------------------------------------------- */}
      <section className="relative isolate">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            // #E2A257 est la couleur de repli du héros d'Uber Eats, relevée
            // dans leur CSS : elle tient l'écran tant que la photo charge, et
            // reste seule si l'établissement n'a pas encore de couverture.
            backgroundColor: '#e2a257',
            backgroundImage: restaurant.cover_url ? `url(${restaurant.cover_url})` : undefined,
          }}
          aria-hidden
        />
        {/* Uber pose son texte noir à même la photo, parce qu'elle est
            choisie claire. Une couverture sombre rendrait le titre illisible :
            ce voile blanc dégradé garantit le contraste quelle que soit
            l'image téléversée depuis le backoffice.
            Le palier à 65 % n'est pas décoratif : sous 900 px, le titre court
            jusqu'aux deux tiers de la largeur, et sans lui « chez vous »
            tombait sur la partie claire de la photo. */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.90) 40%, rgba(255,255,255,0.62) 65%, rgba(255,255,255,0.06) 90%)',
          }}
          aria-hidden
        />

        <div className="ue-container flex min-h-[560px] flex-col justify-center py-16 md:min-h-[620px]">
          <h1 className="ue-display max-w-[15ch]">Livraison près de chez vous</h1>
          <p className="mt-4 max-w-[46ch] text-lg text-[var(--ue-ink-secondary)]">
            {restaurant.tagline ??
              `Les plats d’${restaurant.name}, préparés à la commande et livrés chauds.`}
          </p>

          <div className="mt-8">
            <AddressSearch />
          </div>
        </div>
      </section>

      {/* --- Trois parcours ---------------------------------------------- */}
      <section className="ue-container mt-16 md:mt-20" id="a-propos">
        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          <PathCard
            icon={<Timer size={40} weight="regular" aria-hidden />}
            tint="#f3f3f3"
            title="Livré chez vous"
            description={
              fastestZone !== null
                ? `Commande préparée à la minute, livrée en ${fastestZone} min dans les zones les plus proches.`
                : 'Commande préparée à la minute et livrée à votre porte.'
            }
            href="/feed"
            cta="Commander une livraison"
          />
          <PathCard
            icon={<Storefront size={40} weight="regular" aria-hidden />}
            tint="#e8e8e8"
            title="À emporter"
            description={
              restaurant.pickup_enabled
                ? `Passez récupérer votre commande au ${restaurant.address_line}, sans frais de livraison.`
                : 'Le retrait sur place ouvrira prochainement.'
            }
            href="/feed?mode=retrait"
            cta="Commander à emporter"
          />
          <PathCard
            icon={<Motorcycle size={40} weight="regular" aria-hidden />}
            tint="var(--ue-green-soft)"
            title="Devenez livreur"
            description="Roulez quand vous voulez, encaissez chaque semaine. L’équipe recrute en continu."
            href={restaurant.phone ? `tel:${restaurant.phone}` : '/feed'}
            cta="Nous appeler"
            id="livreur"
          />
        </div>
      </section>

      {/* --- Zones (« Cities near me ») -----------------------------------
          Uber liste des noms de villes ; ici il n'y en a qu'une, et ce qui
          intéresse le client de Kinshasa n'est pas *quelle* ville mais
          *jusqu'où* — et à quel prix. D'où la carte : les anneaux portent le
          barème, les communes servent de repères, le marqueur noir situe le
          restaurant. La liste reste à côté, pour qui lit plus vite qu'il ne
          regarde. */}
      {zones.length > 0 ? (
        <section className="ue-container mt-20" id="zones">
          <div className="flex items-end justify-between gap-4">
            <h2 className="ue-h1">Zones desservies</h2>
            <Link href="/feed" className="shrink-0 text-base font-medium underline">
              Commander maintenant
            </Link>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <KinshasaMap
              restaurant={{
                lat: restaurant.latitude ?? KINSHASA_CENTER.lat,
                lng: restaurant.longitude ?? KINSHASA_CENTER.lng,
                name: restaurant.name,
              }}
              rings={deliveryRings(zones, restaurant.currency)}
              showCommunes
              basemap="voyager"
              height={420}
            />

            <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
              {zones.map((zone) => (
                <li key={zone.id}>
                  <p className="text-base font-medium">{zone.name}</p>
                  <p className="mt-1 text-sm text-[var(--ue-ink-secondary)]">
                    {zone.eta_minutes} min ·{' '}
                    {zone.fee_amount === 0
                      ? 'livraison offerte'
                      : formatMoney(zone.fee_amount, restaurant.currency)}
                    {zone.free_above !== null
                      ? ` · offerte dès ${formatMoney(zone.free_above, restaurant.currency)}`
                      : ''}
                  </p>
                </li>
              ))}

              <li className="text-sm text-[var(--ue-ink-secondary)]">
                Au-delà du dernier anneau, la livraison reste possible partout à{' '}
                {restaurant.city} : le tarif est confirmé au moment de la commande.
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {/* --- Catégories (« Countries with Uber Eats ») -------------------- */}
      {categories.length > 0 ? (
        <section className="ue-container mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="ue-h1">Notre carte</h2>
            <Link href="/feed" className="shrink-0 text-base font-medium underline">
              Tout voir
            </Link>
          </div>

          <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.id}>
                {/* Liste de liens en texte simple, comme la liste de pays
                    d'Uber Eats : l'icône vit dans le rail du feed, pas ici. */}
                <Link
                  href={`/feed?categorie=${category.slug}`}
                  className="text-base hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <StoreFooter phone={restaurant.phone} city={restaurant.city} />
    </>
  );
}

/**
 * Carte de parcours : bloc coloré à rayon 8, titre en gras, lien souligné.
 * Uber y met une photo ; sans banque d'images côté établissement, un aplat et
 * une icône tiennent le même rôle sans avoir l'air d'un trou.
 */
function PathCard({
  icon,
  tint,
  title,
  description,
  href,
  cta,
  id,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  id?: string;
}) {
  return (
    <div id={id}>
      <div
        className="grid h-[180px] place-items-center rounded-[var(--ue-radius)]"
        style={{ background: tint }}
      >
        {icon}
      </div>
      <h3 className="ue-h2 mt-5">{title}</h3>
      <p className="mt-2 text-base text-[var(--ue-ink-secondary)]">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-base font-medium underline underline-offset-2"
      >
        {cta}
        <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Base vierge : les migrations sont passées mais le seed non. On le dit, au
 * lieu de servir une vitrine vide qui aurait l'air cassée.
 */
function EmptyState() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="ue-h1">Vitrine indisponible</h1>
        <p className="mt-3 text-base text-[var(--ue-ink-secondary)]">
          Aucun établissement n’est enregistré en base. Chargez les données initiales, puis
          rechargez cette page.
        </p>
        <Link href="/admin" className="ue-btn ue-btn-primary mt-6">
          Espace restaurant
        </Link>
      </div>
    </main>
  );
}
