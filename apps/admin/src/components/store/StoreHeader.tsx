'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  AppleLogo,
  CaretDown,
  GooglePlayLogo,
  List,
  MagnifyingGlass,
  MapPin,
  ShoppingCart,
  X,
} from '@phosphor-icons/react';
import { selectItemCount, useCartStore, useSession } from '@istanbul/core';
import { Logo } from '@/components/Logo';
import { useStoreCart } from '@/components/store/StoreCart';
import { useDeliveryPrefs } from '@/lib/delivery-prefs';

/**
 * Barre de navigation de la vitrine.
 *
 * Deux variantes, comme chez Uber Eats :
 *
 *   `landing` — logo à gauche, actions à droite. L'adresse n'apparaît qu'une
 *               fois le héros dépassé : tant qu'on voit le grand champ du
 *               héros, un second champ dans l'entête ferait doublon.
 *   `feed`    — la barre de travail : adresse, recherche, panier.
 *
 * Hauteur 64 px (56 en mobile) et `inset 0 -1px 0 #F3F3F3` en guise de
 * séparateur : deux valeurs relevées telles quelles sur le site d'origine.
 *
 * L'adresse et le mode viennent du magasin `delivery-prefs`, pas de props :
 * l'entête, la modale de livraison et le panier doivent afficher la même
 * chose quel que soit l'endroit où elle a été changée.
 *
 * Le clic sur le panier n'a pas besoin d'être passé : le tiroir est monté par
 * la coquille de la vitrine et s'ouvre par contexte. `onCartClick` reste
 * accepté pour un appelant qui voudrait s'intercaler.
 */
export function StoreHeader({
  variant = 'landing',
  search,
  onSearchChange,
  onCartClick,
  onAddressClick,
}: {
  variant?: 'landing' | 'feed';
  search?: string;
  onSearchChange?: (value: string) => void;
  onCartClick?: () => void;
  onAddressClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Sur l'accueil, l'adresse migre du héros vers l'entête au défilement.
  const [scrolled, setScrolled] = useState(false);

  const prefs = useDeliveryPrefs();
  const itemCount = useCartStore(selectItemCount);
  const openCart = useStoreCart();
  const cartClick = onCartClick ?? openCart ?? undefined;

  useEffect(() => {
    if (variant !== 'landing') return;

    const onScroll = () => setScrolled(window.scrollY > 240);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  const isFeed = variant === 'feed';

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-[var(--ue-surface)]"
        style={{ boxShadow: 'var(--ue-shadow-header)' }}
      >
        <div
          className="flex items-center gap-2 px-4 md:gap-4 md:px-6"
          style={{ height: 'var(--ue-header-height)' }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="ue-btn ue-btn-ghost -ml-2 shrink-0 !p-2"
          >
            <List size={24} aria-hidden />
          </button>

          <Link href="/" className="shrink-0" aria-label="Istanbul Fast Food, accueil">
            {/* Sur le feed, le mot-logo cède la place à l'adresse en dessous
                de 768 px : c'est elle qu'on relit et qu'on change, pas le nom
                de l'enseigne sur laquelle on vient justement de cliquer. */}
            <Wordmark textClassName={isFeed ? 'hidden md:inline-block' : undefined} />
          </Link>

          {isFeed ? (
            <>
              {/* Sous 1024 px, l'adresse prend toute la place restante et se
                  tronque : à 375 px il lui reste ~165 px, de quoi lire le
                  début de la rue. Elle ne descend plus sur une seconde ligne
                  où elle se battait avec la recherche pour la moitié de
                  l'écran. Au-delà, `flex-none` lui rend sa largeur fixe et
                  c'est la recherche, remontée dans l'entête, qui occupe le
                  reste. */}
              <div className="min-w-0 flex-1 lg:flex-none">
                <AddressPill address={prefs.address} onClick={onAddressClick} />
              </div>

              <div className="flex shrink-0 items-center gap-2 md:gap-3 lg:ml-auto lg:min-w-0 lg:flex-1 lg:shrink lg:justify-end">
                <div className="hidden min-w-0 flex-1 lg:block">
                  <SearchField value={search} onChange={onSearchChange} />
                </div>

                <CartButton count={itemCount} onClick={cartClick} />
                <AuthButtons compact />
              </div>
            </>
          ) : (
            <>
              {/* Réservation d'espace : la pilule apparaît en fondu, elle ne
                  doit pas pousser le logo au moment où elle entre. */}
              <div
                className="hidden min-w-0 flex-1 transition-opacity duration-200 md:block"
                style={{
                  opacity: scrolled ? 1 : 0,
                  visibility: scrolled ? 'visible' : 'hidden',
                }}
              >
                <AddressPill address={prefs.address} onClick={onAddressClick} />
              </div>

              <div className="ml-auto flex items-center gap-2 md:gap-3">
                <Link
                  href="/feed"
                  className="ue-btn ue-btn-ghost hidden !px-3 text-sm md:inline-flex"
                >
                  Voir la carte
                </Link>
                {itemCount > 0 ? <CartButton count={itemCount} onClick={cartClick} /> : null}
                <AuthButtons />
              </div>
            </>
          )}
        </div>

        {/* Seconde ligne du feed en dessous de 1024 px : la recherche, pleine
            largeur. Elle partageait cette ligne avec l'adresse, chacune sur la
            moitié de 375 px — deux champs illisibles là où il n'en fallait
            qu'un. L'adresse est remontée sur la première ligne. */}
        {isFeed ? (
          <div className="px-4 pb-3 lg:hidden">
            <SearchField value={search} onChange={onSearchChange} />
          </div>
        ) : null}
      </header>

      <StoreDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/**
 * Le logo suivi du mot-logo.
 *
 * Uber écrit « Uber Eats » en deux graisses ; ici « Istanbul » en 800 et
 * « Fast Food » en 500, même principe de contraste dans un seul mot-logo.
 * L'ovale de l'enseigne le précède — le texte reste, car l'ovale n'est plus
 * lisible à cette taille.
 */
function Wordmark({ textClassName = '' }: { textClassName?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Logo height={34} priority />
      <span
        className={['whitespace-nowrap text-xl leading-none md:text-[22px]', textClassName]
          .filter(Boolean)
          .join(' ')}
        style={{ fontFamily: 'var(--ue-font-display)', letterSpacing: '-0.03em' }}
      >
        <span style={{ fontWeight: 800 }}>Istanbul</span>
        {/* « Fast Food » saute sous 640 px : la place gagnée va à l'adresse et
            au panier. */}
        <span style={{ fontWeight: 500 }} className="hidden sm:inline">
          {' '}
          Fast Food
        </span>
      </span>
    </span>
  );
}

function CartButton({ count, onClick }: { count: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ue-btn ue-btn-secondary relative shrink-0"
      aria-label={`Panier, ${count} article${count > 1 ? 's' : ''}`}
    >
      <ShoppingCart size={20} aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {count}
      </span>
    </button>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="relative flex min-w-0 items-center">
      <MagnifyingGlass
        size={20}
        aria-hidden
        className="pointer-events-none absolute left-4 text-[var(--ue-ink)]"
      />
      <span className="sr-only">Rechercher un plat</span>
      <input
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Rechercher un plat"
        className="h-11 w-full rounded-[var(--ue-pill)] bg-[var(--ue-surface-sunken)] pl-12 pr-4 text-base outline-none placeholder:text-[var(--ue-ink-secondary)] md:h-12"
      />
    </label>
  );
}

/**
 * La pilule d'adresse.
 *
 * Bouton quand une modale peut s'ouvrir (sur le feed), lien vers l'accueil
 * sinon : sur la page de commande il n'y a pas de modale à appeler, et un
 * bouton qui ne fait rien est pire qu'un lien.
 */
function AddressPill({
  address,
  onClick,
  className = '',
}: {
  address: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <MapPin size={18} weight="fill" aria-hidden className="shrink-0" />
      <span className="truncate">{address || 'Ajouter une adresse'}</span>
      <span className="hidden shrink-0 text-[var(--ue-ink-secondary)] md:inline">
        • Maintenant
      </span>
      <CaretDown size={14} aria-hidden className="shrink-0" />
    </>
  );

  const classes = `ue-btn ue-btn-ghost w-full min-w-0 max-w-[280px] !justify-start !px-3 text-sm ${className}`;
  const title = address ?? 'Choisir une adresse de livraison';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} title={title}>
        {content}
      </button>
    );
  }

  return (
    <Link href="/" className={classes} title={title}>
      {content}
    </Link>
  );
}

/**
 * Connexion / inscription — un seul parcours derrière deux libellés.
 *
 * `/connexion` sert les deux : le compte est créé s'il n'existe pas. Les deux
 * boutons restent parce que le client cherche l'un ou l'autre selon qu'il se
 * croit déjà inscrit.
 */
function AuthButtons({ compact = false }: { compact?: boolean }) {
  const { session, isLoading } = useSession();

  if (isLoading) return null;

  if (session) {
    return (
      <Link
        href="/commande"
        className={`ue-btn ue-btn-secondary ${compact ? 'hidden lg:inline-flex' : ''}`}
      >
        Mon compte
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/connexion"
        className={`ue-btn ue-btn-secondary ${compact ? 'hidden xl:inline-flex' : 'hidden sm:inline-flex'}`}
      >
        Se connecter
      </Link>
      <Link
        href="/connexion"
        className={`ue-btn ue-btn-primary ${compact ? 'hidden lg:inline-flex' : ''}`}
      >
        S’inscrire
      </Link>
    </>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tiroir latéral, calqué sur celui d'Uber Eats : deux boutons d'accès en
 * haut, les parcours secondaires en dessous, la promo de l'application en
 * pied. Mêmes garanties d'accessibilité que le tiroir du backoffice —
 * Échap ferme, focus piégé et restitué, défilement du corps verrouillé.
 */
function StoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) return;

    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      // Même raison que dans StoreModal : le portal sort du scope du thème,
      // il faut le reposer sur la racine du tiroir.
      data-surface="store"
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-[85vw] max-w-[340px] flex-col overflow-y-auto bg-[var(--ue-surface)] p-6 outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="ue-close mb-4"
        >
          <X size={20} aria-hidden />
        </button>

        <Link href="/connexion" onClick={onClose} className="ue-btn ue-btn-primary w-full">
          S’inscrire
        </Link>
        <Link href="/connexion" onClick={onClose} className="ue-btn ue-btn-secondary mt-3 w-full">
          Se connecter
        </Link>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Liens secondaires">
          {[
            { href: '/feed', label: 'Voir la carte' },
            { href: '/feed?filtre=offres', label: 'Promotions du moment' },
            { href: '/#zones', label: 'Zones de livraison' },
            { href: '/#livreur', label: 'Devenir livreur' },
            // Pas d'entrée vers le backoffice ici : ce tiroir est celui du
            // client. On entre dans l'espace restaurant en tapant /admin.
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="rounded-[var(--ue-radius)] px-2 py-3 text-base font-medium hover:bg-[var(--ue-surface-sunken)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <div className="flex items-center gap-3">
            <Logo height={48} />
            <p className="text-base font-medium leading-snug">Encore mieux dans l’application.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="ue-btn ue-btn-secondary !px-3 !text-sm">
              <AppleLogo size={18} weight="fill" aria-hidden />
              iPhone
            </span>
            <span className="ue-btn ue-btn-secondary !px-3 !text-sm">
              <GooglePlayLogo size={18} weight="fill" aria-hidden />
              Android
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
