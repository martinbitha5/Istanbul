'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  Clock,
  ForkKnife,
  Medal,
  Plus,
  Tag,
  X,
} from '@phosphor-icons/react';
import { formatMoney, formatPercent, selectProductQuantity, useCartStore } from '@istanbul/core';
import type { Category, DeliveryZone, Product, Promotion, Restaurant } from '@istanbul/types';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreFooter } from '@/components/store/StoreFooter';
import { ProductCard } from '@/components/store/ProductCard';
import { CategoryIcon } from '@/components/store/CategoryIcon';
import { ProductModal } from '@/components/store/ProductModal';
import { CartPanel } from '@/components/store/CartPanel';
import { DeliveryDetailsModal } from '@/components/store/DeliveryDetailsModal';
import { COVERAGE_CITY, isInCoverage } from '@/lib/coverage';
import { useDeliveryPrefs } from '@/lib/delivery-prefs';

type SortKey = 'recommended' | 'rating' | 'price-asc';

/**
 * La carte — la page sur laquelle on atterrit après avoir saisi son adresse.
 *
 * Elle enchaîne trois états, dans cet ordre :
 *
 *   1. aucune adresse    → la modale de livraison s'ouvre et ne se ferme pas.
 *                          Rien n'est présenté avant de savoir où livrer.
 *   2. adresse hors zone → l'écran « bientôt chez vous », comme Uber Eats sur
 *                          une ville qu'il ne dessert pas encore.
 *   3. adresse à Kinshasa → la carte complète.
 *
 * Les rayons thématiques (offres, plus commandés) gardent la carte visuelle du
 * feed Uber ; « Toute la carte » adopte la mise en page de la page boutique —
 * navigation de sections à gauche, plats en lignes avec vignette à droite.
 * Deux références différentes, deux usages différents : on découvre en
 * images, on commande en liste.
 */
export function FeedView({
  restaurant,
  categories,
  products,
  promotions,
  zones,
  initialCategorySlug,
  initialFilter,
}: {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
  zones: DeliveryZone[];
  initialCategorySlug: string | null;
  initialFilter: string | null;
}) {
  const prefs = useDeliveryPrefs();

  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug);
  const [offersOnly, setOffersOnly] = useState(initialFilter === 'offres');
  const [popularOnly, setPopularOnly] = useState(initialFilter === 'populaires');
  const [sort, setSort] = useState<SortKey>('recommended');

  const [addressOpen, setAddressOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  // `useDeliveryPrefs` renvoie l'état vide au rendu serveur puis l'adresse
  // réelle au premier rendu client. Sans ce drapeau, un client qui a déjà son
  // adresse verrait la modale clignoter à chaque chargement.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasAddress = Boolean(prefs.address);
  const covered = prefs.mode === 'pickup' || isInCoverage(prefs.address);
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
  // thématiques par une liste unique : empiler « Populaires » et « Tout »
  // après un filtre donnerait deux fois les mêmes plats.
  const isFiltered =
    activeCategory !== null || search.trim().length > 0 || offersOnly || popularOnly;

  const popular = products.filter((product) => product.is_popular).slice(0, 8);
  const deals = products
    .filter(
      (product) =>
        product.compare_at_price !== null && product.compare_at_price > product.base_price,
    )
    .slice(0, 8);

  const cheapestZone = zones.reduce<DeliveryZone | null>(
    (best, zone) => (best === null || zone.fee_amount < best.fee_amount ? zone : best),
    null,
  );

  const freeAbove = zones.reduce<number | null>((best, zone) => {
    if (zone.free_above === null) return best;
    return best === null || zone.free_above < best ? zone.free_above : best;
  }, null);

  const header = (
    <StoreHeader
      variant="feed"
      search={search}
      onSearchChange={setSearch}
      onCartClick={() => setCartOpen(true)}
      onAddressClick={() => setAddressOpen(true)}
    />
  );

  const modals = (
    <>
      <DeliveryDetailsModal
        open={addressOpen || (mounted && !hasAddress)}
        onClose={() => setAddressOpen(false)}
        required={mounted && !hasAddress}
      />
      <ProductModal
        productId={productId}
        currency={currency}
        onClose={() => setProductId(null)}
      />
      <CartPanel
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        products={products}
      />
    </>
  );

  // --- 1. Pas encore d'adresse -------------------------------------------
  if (mounted && !hasAddress) {
    return (
      <>
        {header}
        <main className="ue-container flex min-h-[50dvh] flex-col items-center justify-center py-20 text-center">
          <h1 className="ue-h1">Où livrons-nous ?</h1>
          <p className="mt-3 max-w-[42ch] text-base text-[var(--ue-ink-secondary)]">
            Indiquez votre adresse pour découvrir la carte, les prix et le délai de livraison
            chez vous.
          </p>
        </main>
        {modals}
      </>
    );
  }

  // --- 2. Adresse hors de Kinshasa ---------------------------------------
  if (mounted && !covered) {
    return (
      <>
        {header}
        <OutOfCoverage address={prefs.address} onChangeAddress={() => setAddressOpen(true)} />
        <StoreFooter phone={restaurant.phone} city={restaurant.city} />
        {modals}
      </>
    );
  }

  // --- 3. Carte complète --------------------------------------------------
  return (
    <>
      {header}

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
          <ServiceBar
            restaurant={restaurant}
            zone={cheapestZone}
            mode={prefs.mode}
            slot={prefs.slot}
          />

          <CategoryRail
            categories={categories}
            activeSlug={categorySlug}
            onSelect={(slug) => setCategorySlug(slug === categorySlug ? null : slug)}
          />

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

          {!isFiltered && promotions.length > 0 ? (
            <PromoCarousel promotions={promotions} currency={currency} />
          ) : null}

          {isFiltered ? (
            <MenuSection
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
              onOpen={setProductId}
            />
          ) : (
            <>
              {deals.length > 0 ? (
                <CardSection
                  title="Offres du moment"
                  products={deals}
                  currency={currency}
                  promoLabel="Prix réduit"
                  onOpen={setProductId}
                />
              ) : null}
              {popular.length > 0 ? (
                <CardSection
                  title="Les plus commandés"
                  products={popular}
                  currency={currency}
                  onOpen={setProductId}
                />
              ) : null}

              {/* La carte, catégorie par catégorie — mise en page de la page
                  boutique. Chaque section porte l'ancre visée par la colonne
                  de gauche. */}
              {categories.map((category) => {
                const items = products.filter(
                  (product) => product.category_id === category.id,
                );
                if (items.length === 0) return null;

                return (
                  <MenuSection
                    key={category.id}
                    id={`categorie-${category.slug}`}
                    title={category.name}
                    products={items}
                    currency={currency}
                    onOpen={setProductId}
                  />
                );
              })}
            </>
          )}
        </main>
      </div>

      {freeAbove !== null && prefs.mode === 'delivery' ? (
        <FreeDeliveryBanner amount={formatMoney(freeAbove, currency)} />
      ) : null}

      <StoreFooter phone={restaurant.phone} city={restaurant.city} />
      {modals}
    </>
  );
}

/**
 * « Nous vous proposerons bientôt nos services ».
 *
 * L'écran qu'Uber Eats sert sur une ville hors couverture, transposé : on ne
 * livre qu'à Kinshasa aujourd'hui, et une adresse ailleurs mérite une réponse
 * claire plutôt qu'une carte qu'on ne pourra pas honorer.
 */
function OutOfCoverage({
  address,
  onChangeAddress,
}: {
  address: string | null;
  onChangeAddress: () => void;
}) {
  return (
    <main className="ue-container flex min-h-[60dvh] flex-col items-center justify-center py-20 text-center">
      <UnavailableIllustration />

      <h1 className="ue-h2 mt-8">Nous vous proposerons bientôt nos services</h1>
      <p className="mt-3 max-w-[46ch] text-base text-[var(--ue-ink-secondary)]">
        Nous ne livrons qu’à {COVERAGE_CITY} pour le moment, et nous élargissons la zone peu à
        peu. Revenez nous voir prochainement.
      </p>

      {address ? (
        <p className="mt-4 text-sm text-[var(--ue-ink-secondary)]">
          Adresse saisie : <span className="font-medium">{address}</span>
        </p>
      ) : null}

      <button type="button" onClick={onChangeAddress} className="ue-btn ue-btn-primary mt-8">
        Changer d’adresse
      </button>
    </main>
  );
}

/**
 * L'illustration de l'écran vide.
 *
 * Dessinée ici plutôt que reprise : le visuel d'Uber Eats est une œuvre
 * graphique qui leur appartient. Mêmes teintes que le reste de la vitrine, et
 * `aria-hidden` — le message est porté par le texte à côté.
 */
function UnavailableIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden>
      <rect x="18" y="46" width="34" height="56" rx="6" fill="#e8e8e8" />
      <rect x="24" y="36" width="22" height="14" rx="4" fill="var(--ue-green)" />
      <path d="M70 92 L116 60 L146 92 Z" fill="#d9a6a0" />
      <rect x="66" y="90" width="84" height="12" rx="6" fill="#8c4f4a" />
      <circle cx="112" cy="72" r="4" fill="#ffffff" />
      <circle cx="60" cy="106" r="3" fill="#e8e8e8" />
      <circle cx="76" cy="112" r="3" fill="#e8e8e8" />
      <circle cx="132" cy="108" r="3" fill="#e8e8e8" />
    </svg>
  );
}

/**
 * La barre d'informations de service, reprise de la page boutique : mode,
 * frais de livraison et délai, sur une ligne encadrée.
 */
function ServiceBar({
  restaurant,
  zone,
  mode,
  slot,
}: {
  restaurant: Restaurant;
  zone: DeliveryZone | null;
  mode: 'delivery' | 'pickup';
  slot: string | null;
}) {
  const eta = zone?.eta_minutes ?? restaurant.avg_prep_minutes;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[var(--ue-radius)] border border-[var(--ue-border)] px-5 py-4">
      <p className="text-base font-medium">
        {mode === 'pickup' ? 'À emporter' : 'Livraison'}
      </p>

      {mode === 'delivery' ? (
        <p className="text-base" style={{ color: 'var(--ue-green-text)' }}>
          {zone && zone.fee_amount === 0
            ? 'Livraison offerte'
            : `Frais de livraison dès ${formatMoney(zone?.fee_amount ?? 0, restaurant.currency)}`}
        </p>
      ) : (
        <p className="text-base text-[var(--ue-ink-secondary)]">
          {restaurant.address_line}
        </p>
      )}

      <p className="flex items-center gap-2 text-base text-[var(--ue-ink-secondary)]">
        <Clock size={18} aria-hidden />
        {slot ?? `${eta} min`}
      </p>

      {!restaurant.is_accepting_orders || !restaurant.is_open ? (
        <p className="text-base font-medium" style={{ color: 'var(--ue-promo)' }}>
          Commandes fermées pour le moment
        </p>
      ) : null}
    </div>
  );
}

/**
 * Colonne de gauche, au-delà de 1024 px.
 *
 * Uber y range ses verticales (Grocery, Convenience, Alcohol…) sur le feed, et
 * les sections de la carte sur une page boutique. Pour un établissement
 * unique, c'est le second usage qui sert : ce sont les catégories de la carte,
 * et un clic filtre la liste.
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
        <Tag size={22} aria-hidden />
        Offres
      </button>
    </aside>
  );
}

/**
 * Rail de catégories en pastilles rondes, avec les flèches d'Uber.
 *
 * Les flèches ne sont pas décoratives : à la souris sans molette horizontale,
 * un rail sans commande est inatteignable.
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
    <div className="relative mt-6">
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
      {side === 'left' ? <CaretLeft size={18} aria-hidden /> : <CaretRight size={18} aria-hidden />}
    </button>
  );
}

/**
 * Carrousel promotionnel.
 *
 * Uber alterne des aplats colorés portant un titre, une accroche et un
 * visuel à droite. Les teintes tournent sur une petite palette pour que deux
 * cartes voisines ne soient jamais identiques.
 */
function PromoCarousel({ promotions, currency }: { promotions: Promotion[]; currency: string }) {
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
  // `value` est en points de base pour une remise en pourcentage (2000 = 20 %).
  if (promotion.type === 'PERCENTAGE') return `−${formatPercent(promotion.value)}`;
  return `−${formatMoney(promotion.value, currency)}`;
}

/** Rayon en cartes visuelles — la carte du feed Uber Eats. */
function CardSection({
  title,
  products,
  currency,
  promoLabel,
  onOpen,
}: {
  title: string;
  products: Product[];
  currency: string;
  promoLabel?: string;
  onOpen: (productId: string) => void;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="ue-h2">{title}</h2>

      <div
        // Progression calée sur celle d'Uber Eats, barre latérale déduite :
        // trois colonnes à partir de 1280 px (cartes de ~360 px, leur
        // largeur), quatre au-delà de 1536 px.
        className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            currency={currency}
            promoLabel={promoLabel}
            onOpen={() => onOpen(product.id)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Section de carte — la mise en page de la page boutique : deux colonnes de
 * lignes, texte à gauche, vignette et bouton « + » à droite.
 */
function MenuSection({
  id,
  title,
  products,
  currency,
  onOpen,
}: {
  id?: string;
  title: string;
  products: Product[];
  currency: string;
  onOpen: (productId: string) => void;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="ue-h2">{title}</h2>

      {products.length === 0 ? (
        <p className="mt-4 text-base text-[var(--ue-ink-secondary)]">
          Aucun plat ne correspond à cette sélection.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:gap-x-6">
          {products.map((product) => (
            <MenuRow
              key={product.id}
              product={product}
              currency={currency}
              onOpen={() => onOpen(product.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MenuRow({
  product,
  currency,
  onOpen,
}: {
  product: Product;
  currency: string;
  onOpen: () => void;
}) {
  const inCart = useCartStore(selectProductQuantity(product.id));
  const discounted =
    product.compare_at_price !== null && product.compare_at_price > product.base_price;

  return (
    <div
      className="relative flex gap-4 rounded-[var(--ue-radius)] border border-[var(--ue-border)] p-4 transition-shadow duration-200 hover:shadow-[var(--ue-shadow-card)]"
      style={{ opacity: product.is_available ? 1 : 0.6 }}
    >
      <div className="min-w-0 flex-1">
        {/* Le titre porte le bouton étendu : toute la carte est cliquable,
            mais un seul élément est annoncé au lecteur d'écran. */}
        <button type="button" onClick={onOpen} className="text-left">
          <span className="absolute inset-0" aria-hidden />
          <span className="block text-base font-medium leading-6">{product.name}</span>
        </button>

        <p className="mt-1 flex items-baseline gap-2 text-base">
          <span>{formatMoney(product.base_price, currency)}</span>
          {discounted ? (
            <span className="text-sm text-[var(--ue-ink-tertiary)] line-through">
              {formatMoney(product.compare_at_price!, currency)}
            </span>
          ) : null}
        </p>

        {product.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--ue-ink-secondary)]">
            {product.description}
          </p>
        ) : null}

        {!product.is_available ? (
          <p className="mt-2 text-sm font-medium text-[var(--ue-ink-secondary)]">Épuisé</p>
        ) : null}
      </div>

      <div className="relative h-[104px] w-[104px] shrink-0">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="104px"
            className="rounded-[var(--ue-radius)] object-cover"
          />
        ) : (
          <div className="ue-skeleton absolute inset-0 rounded-[var(--ue-radius)]" aria-hidden />
        )}

        {/* Au-dessus du lien étendu (`z-10`), sinon le clic sur « + » serait
            capté par la carte et ouvrirait quand même la fiche. */}
        <button
          type="button"
          onClick={onOpen}
          disabled={!product.is_available}
          aria-label={`Ajouter ${product.name}`}
          className="absolute -bottom-2 -right-2 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--ue-surface)] text-base font-medium disabled:cursor-not-allowed"
          style={{ boxShadow: 'var(--ue-shadow-card)' }}
        >
          {inCart > 0 ? (
            <span className="tabular-nums">{inCart}</span>
          ) : (
            <Plus size={18} weight="bold" aria-hidden />
          )}
        </button>
      </div>
    </div>
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
