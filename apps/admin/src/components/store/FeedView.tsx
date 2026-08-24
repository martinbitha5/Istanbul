'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  ForkKnife,
  Medal,
  Percent,
  Tag,
  X,
} from '@phosphor-icons/react';
import { formatMoney, formatPercent } from '@istanbul/core';
import type { Category, DeliveryZone, Product, Promotion, Restaurant } from '@istanbul/types';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreFooter } from '@/components/store/StoreFooter';
import { ProductCard } from '@/components/store/ProductCard';
import { CategoryIcon } from '@/components/store/CategoryIcon';
import { ADDRESS_STORAGE_KEY } from '@/components/store/AddressSearch';

type SortKey = 'recommended' | 'rating' | 'price-asc';

/**
 * Le feed — la page sur laquelle on atterrit après avoir saisi son adresse.
 *
 * Structure reprise d'Uber Eats, de haut en bas : entête de travail
 * (Livraison/À emporter, adresse, recherche, panier), colonne de navigation à
 * gauche au-delà de 1024 px, rail de catégories en pastilles rondes, puis
 * puces de filtre, carrousel promotionnel et sections de cartes.
 *
 * Ce qu'un marché multi-restaurants remplit avec des enseignes, un
 * établissement unique le remplit avec ses plats : le rail liste les
 * catégories de la carte, les cartes sont des produits, et le bandeau
 * « $0 Delivery Fee with Uber One » devient le seuil de livraison offerte de
 * la zone la plus généreuse.
 */
export function FeedView({
  restaurant,
  categories,
  products,
  promotions,
  zones,
  initialAddress,
  initialCategorySlug,
  initialFilter,
  initialMode,
}: {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
  zones: DeliveryZone[];
  initialAddress: string | null;
  initialCategorySlug: string | null;
  initialFilter: string | null;
  initialMode: 'delivery' | 'pickup';
}) {
  const [address, setAddress] = useState(initialAddress);
  const [mode, setMode] = useState<'delivery' | 'pickup'>(initialMode);
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug);
  const [offersOnly, setOffersOnly] = useState(initialFilter === 'offres');
  const [popularOnly, setPopularOnly] = useState(initialFilter === 'populaires');
  const [sort, setSort] = useState<SortKey>('recommended');

  // L'adresse n'est pas toujours dans l'URL : quand on arrive par un lien
  // direct ou un favori, elle vient du choix précédent conservé localement.
  useEffect(() => {
    if (initialAddress) return;
    try {
      setAddress(window.localStorage.getItem(ADDRESS_STORAGE_KEY));
    } catch {
      // Stockage refusé : l'entête affichera « Ajouter une adresse ».
    }
  }, [initialAddress]);

  const currency = restaurant.currency;

  const activeCategory = categories.find((category) => category.slug === categorySlug) ?? null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = products.filter((product) => {
      if (activeCategory && product.category_id !== activeCategory.id) return false;
      if (popularOnly && !product.is_popular) return false;
      if (
        offersOnly &&
        !(product.compare_at_price !== null && product.compare_at_price > product.base_price)
      ) {
        return false;
      }
      if (term.length > 0) {
        const haystack = `${product.name} ${product.description ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    // Copie avant tri : `products` vient des props, le muter ferait diverger
    // les sections dérivées ci-dessous.
    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.base_price - b.base_price;
      if (sort === 'rating') {
        const ratingA = a.rating_count > 0 ? a.rating_sum / a.rating_count : 0;
        const ratingB = b.rating_count > 0 ? b.rating_sum / b.rating_count : 0;
        return ratingB - ratingA;
      }
      return 0;
    });
  }, [products, activeCategory, popularOnly, offersOnly, search, sort]);

  // Une sélection active (catégorie, recherche, filtre) remplace les rayons
  // thématiques par une grille unique : empiler « Populaires » et « Tout »
  // après un filtre donnerait deux fois les mêmes plats.
  const isFiltered =
    activeCategory !== null || search.trim().length > 0 || offersOnly || popularOnly;

  const popular = products.filter((product) => product.is_popular).slice(0, 8);
  const recommended = products.filter((product) => product.is_recommended).slice(0, 8);
  const deals = products
    .filter(
      (product) =>
        product.compare_at_price !== null && product.compare_at_price > product.base_price,
    )
    .slice(0, 8);

  const freeAbove = zones.reduce<number | null>((best, zone) => {
    if (zone.free_above === null) return best;
    return best === null || zone.free_above < best ? zone.free_above : best;
  }, null);

  return (
    <>
      <StoreHeader
        variant="feed"
        address={address}
        mode={mode}
        onModeChange={setMode}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="flex">
        <FeedSidebar
          categories={categories}
          activeSlug={categorySlug}
          onSelect={setCategorySlug}
          onOffers={() => {
            setOffersOnly(true);
            setCategorySlug(null);
          }}
        />

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 md:px-6">
          {/* --- Rail de catégories ------------------------------------- */}
          <CategoryRail
            categories={categories}
            activeSlug={categorySlug}
            onSelect={(slug) => setCategorySlug(slug === categorySlug ? null : slug)}
          />

          {/* --- Puces de filtre ---------------------------------------- */}
          <div className="ue-rail mt-6 gap-2 pb-1">
            <button
              type="button"
              className="ue-chip"
              aria-pressed={offersOnly}
              onClick={() => setOffersOnly((value) => !value)}
            >
              <Tag size={16} aria-hidden />
              Offres
            </button>
            <button
              type="button"
              className="ue-chip"
              aria-pressed={popularOnly}
              onClick={() => setPopularOnly((value) => !value)}
            >
              <Medal size={16} aria-hidden />
              Les plus commandés
            </button>

            <label className="ue-chip relative !py-0 !pr-9">
              <span className="sr-only">Trier les plats</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="cursor-pointer appearance-none bg-transparent py-2 pr-1 text-sm font-medium outline-none"
              >
                <option value="recommended">Trier : conseillé</option>
                <option value="rating">Trier : mieux notés</option>
                <option value="price-asc">Trier : prix croissant</option>
              </select>
              <CaretDown size={14} aria-hidden className="pointer-events-none absolute right-4" />
            </label>

            {isFiltered ? (
              <button
                type="button"
                className="ue-chip"
                onClick={() => {
                  setCategorySlug(null);
                  setOffersOnly(false);
                  setPopularOnly(false);
                  setSearch('');
                }}
              >
                <X size={14} aria-hidden />
                Effacer
              </button>
            ) : null}
          </div>

          <p className="mt-4 border-t border-[var(--ue-border-subtle)] pt-3 text-sm text-[var(--ue-ink-secondary)]">
            Prix affichés taxes comprises.{' '}
            {mode === 'pickup'
              ? 'Retrait sur place, sans frais de livraison.'
              : `Frais de livraison calculés à la commande selon votre zone.`}
          </p>

          {/* --- Carrousel promotionnel --------------------------------- */}
          {!isFiltered && promotions.length > 0 ? (
            <PromoCarousel promotions={promotions} currency={currency} />
          ) : null}

          {/* --- Grilles ------------------------------------------------ */}
          {isFiltered ? (
            <Section
              title={
                activeCategory
                  ? activeCategory.name
                  : search.trim().length > 0
                    ? `Résultats pour « ${search.trim()} »`
                    : offersOnly
                      ? 'Offres du moment'
                      : 'Les plus commandés'
              }
              products={filtered}
              currency={currency}
            />
          ) : (
            <>
              {deals.length > 0 ? (
                <Section
                  title="Offres du moment"
                  products={deals}
                  currency={currency}
                  promoLabel="Prix réduit"
                />
              ) : null}
              {popular.length > 0 ? (
                <Section title="Les plus commandés" products={popular} currency={currency} />
              ) : null}
              {recommended.length > 0 ? (
                <Section title="La sélection du chef" products={recommended} currency={currency} />
              ) : null}
              <Section title="Toute la carte" products={filtered} currency={currency} />
            </>
          )}
        </main>
      </div>

      {freeAbove !== null && mode === 'delivery' ? (
        <FreeDeliveryBanner amount={formatMoney(freeAbove, currency)} />
      ) : null}

      <StoreFooter phone={restaurant.phone} city={restaurant.city} />
    </>
  );
}

/**
 * Colonne de gauche, au-delà de 1024 px.
 *
 * Uber y range ses verticales (Grocery, Convenience, Alcohol…). Pour un
 * établissement unique, ce sont les catégories de la carte — c'est le même
 * geste : un accès permanent, qui ne défile pas avec le contenu.
 */
function FeedSidebar({
  categories,
  activeSlug,
  onSelect,
  onOffers,
}: {
  categories: Category[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
  onOffers: () => void;
}) {
  const item =
    'flex w-full cursor-pointer items-center gap-3 rounded-[var(--ue-pill)] px-4 py-2.5 text-left text-base font-medium transition-colors duration-200';

  return (
    <aside
      className="sticky hidden w-[248px] shrink-0 self-start overflow-y-auto border-r border-[var(--ue-border-subtle)] p-4 lg:block"
      style={{
        top: 'var(--ue-header-height)',
        maxHeight: 'calc(100dvh - var(--ue-header-height))',
      }}
      aria-label="Catégories"
    >
      <button
        type="button"
        className={item}
        onClick={() => onSelect(null)}
        style={{ background: activeSlug === null ? 'var(--ue-surface-sunken)' : 'transparent' }}
      >
        <ForkKnife size={22} aria-hidden />
        Toute la carte
      </button>

      {categories.map((category) => {
        const active = category.slug === activeSlug;
        return (
          <button
            key={category.id}
            type="button"
            className={item}
            onClick={() => onSelect(category.slug)}
            style={{ background: active ? 'var(--ue-surface-sunken)' : 'transparent' }}
          >
            <span aria-hidden className="grid w-[22px] shrink-0 place-items-center">
              <CategoryIcon name={category.icon} />
            </span>
            <span className="truncate">{category.name}</span>
          </button>
        );
      })}

      <div className="my-3 border-t border-[var(--ue-border-subtle)]" />

      <button type="button" className={item} onClick={onOffers}>
        <Percent size={22} aria-hidden />
        Offres
      </button>
      <Link href="/admin/login" className={item}>
        Se connecter
      </Link>
    </aside>
  );
}

/**
 * Rail de catégories en pastilles rondes, avec les flèches d'Uber.
 *
 * Les flèches ne sont pas décoratives : au clavier et à la souris sans
 * molette horizontale, un rail sans commande est inatteignable.
 */
function CategoryRail({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: Category[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  if (categories.length === 0) return null;

  const scrollBy = (direction: 1 | -1) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div ref={railRef} className="ue-rail gap-6 py-2">
        {categories.map((category) => {
          const active = category.slug === activeSlug;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.slug)}
              aria-pressed={active}
              className="flex w-[76px] cursor-pointer flex-col items-center gap-1.5"
            >
              <span
                aria-hidden
                className="grid h-14 w-14 place-items-center overflow-hidden rounded-full"
                style={{
                  background: 'var(--ue-surface-sunken)',
                  backgroundImage: category.image_url ? `url(${category.image_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  outline: active ? '2px solid var(--ue-ink)' : 'none',
                  outlineOffset: '2px',
                }}
              >
                {category.image_url ? null : <CategoryIcon name={category.icon} size={26} />}
              </span>
              <span className="line-clamp-2 text-center text-sm font-medium leading-4">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

      <RailArrow side="left" onClick={() => scrollBy(-1)} />
      <RailArrow side="right" onClick={() => scrollBy(1)} />
    </div>
  );
}

function RailArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Faire défiler vers la gauche' : 'Faire défiler vers la droite'}
      className="absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)] md:grid"
      style={{
        left: side === 'left' ? '-4px' : undefined,
        right: side === 'right' ? '-4px' : undefined,
        boxShadow: 'var(--ue-shadow-pop)',
      }}
    >
      {side === 'left' ? (
        <CaretLeft size={18} aria-hidden />
      ) : (
        <CaretRight size={18} aria-hidden />
      )}
    </button>
  );
}

/**
 * Carrousel promotionnel.
 *
 * Uber alterne des aplats colorés portant un titre, une accroche et un lien.
 * Les teintes tournent sur une petite palette pour que deux cartes voisines
 * ne soient jamais identiques — leurs bannières sont des visuels de marque,
 * ici ce sont nos promotions réelles.
 */
function PromoCarousel({
  promotions,
  currency,
}: {
  promotions: Promotion[];
  currency: string;
}) {
  const tints = ['#fdf1e3', '#e6f8ee', '#f1efff', '#fdeceb'];

  return (
    <div className="ue-rail mt-6 gap-4">
      {promotions.map((promotion, index) => (
        <div
          key={promotion.id}
          className="flex w-[86vw] overflow-hidden rounded-[var(--ue-radius)] sm:w-[440px]"
          style={{ background: tints[index % tints.length], minHeight: 180 }}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-between p-6">
            <div>
              <p className="text-sm font-medium text-[var(--ue-ink-secondary)]">
                {promoBadge(promotion, currency)}
              </p>
              <p className="ue-h3 mt-1">{promotion.title}</p>
              {promotion.description ? (
                <p className="mt-2 text-base text-[var(--ue-ink-secondary)]">
                  {promotion.description}
                </p>
              ) : null}
            </div>

            <p className="mt-4 text-base font-medium">
              {promotion.min_order_amount > 0
                ? `Dès ${formatMoney(promotion.min_order_amount, currency)} de commande`
                : 'Sans minimum de commande'}
            </p>
          </div>

          {/* Visuel à droite, comme les bannières partenaires d'Uber Eats. */}
          {promotion.image_url ? (
            <div
              aria-hidden
              className="w-[34%] shrink-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${promotion.image_url})` }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * L'accroche chiffrée au-dessus du titre.
 *
 * Une promotion de type `FIXED_AMOUNT` à valeur nulle n'est pas une remise :
 * c'est une bannière d'annonce (le seed en pose une pour « Le Mixte XL est
 * arrivé »). Afficher « −0,00 $ » dessus serait à la fois faux et ridicule.
 */
function promoBadge(promotion: Promotion, currency: string): string {
  if (promotion.type === 'FREE_DELIVERY') return 'Livraison offerte';
  if (promotion.value <= 0) return 'Nouveauté';
  // `value` est en points de base pour une remise en pourcentage
  // (2000 = 20 %) : `formatPercent` fait déjà la conversion, comme dans le
  // backoffice.
  if (promotion.type === 'PERCENTAGE') return `−${formatPercent(promotion.value)}`;
  return `−${formatMoney(promotion.value, currency)}`;
}

function Section({
  title,
  products,
  currency,
  promoLabel,
}: {
  title: string;
  products: Product[];
  currency: string;
  promoLabel?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="ue-h2">{title}</h2>

      {products.length === 0 ? (
        <p className="mt-4 text-base text-[var(--ue-ink-secondary)]">
          Aucun plat ne correspond à cette sélection.
        </p>
      ) : (
        <div
          // Progression calée sur celle d'Uber Eats, barre latérale déduite :
          // trois colonnes à partir de 1280 px (cartes de ~360 px, leur
          // largeur), quatre seulement au-delà de 1536 px. Passer à quatre dès
          // 1280 tombait à 226 px par carte — le visuel 16:9 devenait une
          // vignette.
          className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
              promoLabel={promoLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Le bandeau collant du bas — l'équivalent du « $0 Delivery Fee with Uber One ». */
function FreeDeliveryBanner({ amount }: { amount: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="sticky bottom-0 z-30 flex items-center gap-4 px-4 py-3.5 md:px-6"
      style={{ background: 'var(--ue-deep)', color: 'var(--ue-ink-inverse)' }}
    >
      <p className="flex-1 text-center text-base font-medium">
        Livraison offerte dès {amount} de commande.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer ce bandeau"
        className="shrink-0 cursor-pointer p-1"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}
