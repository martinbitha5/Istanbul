'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartLineUp,
  ForkKnife,
  Gear,
  List,
  MapTrifold,
  Motorcycle,
  Receipt,
  SignOut,
  SquaresFour,
  Storefront,
  Tag,
  UsersThree,
  Users,
  X,
} from '@phosphor-icons/react';
import { signOut, useProfile, useRestaurantDetail } from '@istanbul/core';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  useRestaurantAccess,
  useRestaurantContext,
  type RestaurantAccess,
} from '@/providers/RestaurantProvider';

/**
 * Navigation, groupée par intention.
 *
 * Dix entrées à plat, c'est une liste qu'on relit à chaque fois. Trois
 * groupes courts — ce que je fais maintenant, ce que je fais vendre, ce que
 * j'administre — se parcourent d'un coup d'œil.
 *
 * `need` est le droit minimum. Une entrée invisible n'est pas une sécurité :
 * la RLS refuse déjà l'écriture. Elle évite d'exposer une page qui
 * n'afficherait que des erreurs à un membre « Équipe ».
 */
const NAV_GROUPS: {
  label: string | null;
  items: {
    href: string;
    label: string;
    icon: typeof ChartLineUp;
    need: keyof RestaurantAccess;
  }[];
}[] = [
  {
    label: null,
    items: [
      { href: '/admin', label: 'Vue d’ensemble', icon: ChartLineUp, need: 'view' },
      { href: '/admin/orders', label: 'Commandes', icon: Receipt, need: 'view' },
    ],
  },
  {
    label: 'Carte',
    items: [
      { href: '/admin/menu', label: 'Menu', icon: ForkKnife, need: 'manage' },
      { href: '/admin/categories', label: 'Catégories', icon: SquaresFour, need: 'manage' },
      { href: '/admin/promotions', label: 'Promotions', icon: Tag, need: 'manage' },
    ],
  },
  {
    label: 'Exploitation',
    items: [
      { href: '/admin/drivers', label: 'Livreurs', icon: Motorcycle, need: 'manage' },
      { href: '/admin/zones', label: 'Zones de livraison', icon: MapTrifold, need: 'manage' },
      { href: '/admin/customers', label: 'Clients', icon: Users, need: 'view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/staff', label: 'Équipe', icon: UsersThree, need: 'admin' },
      { href: '/admin/settings', label: 'Établissement', icon: Gear, need: 'admin' },
    ],
  },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Coquille du dashboard.
 *
 * Sidebar fixe au-delà de 1024 px, tiroir en dessous : le gérant consulte
 * souvent depuis un téléphone posé près de la caisse.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const access = useRestaurantAccess();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/admin/login');
    router.refresh();
  };

  const nav = (
    <nav className="flex flex-col gap-4" aria-label="Navigation principale">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => access[item.need]);
        if (items.length === 0) return null;

        return (
          <div key={group.label ?? 'principal'}>
            {group.label ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                {group.label}
              </p>
            ) : null}

            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    // La cible fait 44 px de haut (py-2.5 + line-height) :
                    // le gérant navigue au pouce depuis un téléphone posé
                    // près de la caisse.
                    // Pilule pleine largeur : le rayon 500 d'Uber, appliqué
                    // à une entrée de navigation.
                    // La graisse double le gris pour marquer l'entrée active :
                    // en monochrome, deux gris voisins ne suffisent pas à
                    // distinguer « sélectionné » de « survolé ».
                    className={`flex cursor-pointer items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-colors duration-150 ${
                      active
                        ? 'font-semibold'
                        : 'font-medium hover:bg-[var(--color-surface-sunken)]'
                    }`}
                    style={{
                      background: active ? 'var(--color-primary-soft)' : undefined,
                      color: active
                        ? 'var(--color-on-primary-soft)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    <Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Lien d'évitement : au clavier, on ne veut pas retraverser onze
          entrées de navigation à chaque changement de page. */}
      <a
        href="#contenu"
        className="sr-only rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}
      >
        Aller au contenu
      </a>

      {/* --- Sidebar (desktop) ------------------------------------------ */}
      {/* Filet de séparation sur `divider` (#EEE) et non `border` : c'est le
          trait d'Uber, assez présent pour poser la colonne, assez discret
          pour ne pas la transformer en encadré. */}
      <aside
        className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-divider)] bg-[var(--color-surface)] p-4 lg:flex"
        style={{ position: 'sticky', top: 0, height: '100dvh' }}
      >
        <Brand />
        <div className="mt-4">
          <ServiceState />
        </div>
        {/* La navigation défile, pas la sidebar : le pied de page (thème,
            compte, déconnexion) doit rester atteignable même sur un écran
            de portable à 720 px de haut. */}
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <UserFooter profile={profile} onSignOut={handleSignOut} />
      </aside>

      {/* --- Tiroir (mobile) -------------------------------------------- */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="flex items-center justify-between">
          <Brand />
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-surface-muted)]"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-4">
          <ServiceState />
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <UserFooter profile={profile} onSignOut={handleSignOut} />
      </MobileDrawer>

      {/* --- Contenu ----------------------------------------------------- */}
      <div className="min-w-0 flex-1">
        {/* Même entête que la vitrine en mobile : 56 px, fond plein, et le
            filet posé en `inset` plutôt qu'en bordure — c'est ce qui donne
            au trait son épaisseur d'un pixel exact au défilement. */}
        <header
          className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--color-background)] px-4 lg:hidden"
          style={{
            height: 'var(--ue-header-height)',
            boxShadow: 'inset 0 -1px 0 var(--color-divider)',
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="-ml-2 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200 hover:bg-[var(--color-surface-sunken)]"
          >
            <List size={24} aria-hidden />
          </button>
          <Brand compact />
        </header>

        <main id="contenu" className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Tiroir mobile accessible : mêmes garanties que le Modal de ui.tsx —
 * Échap ferme, piège de focus, focus initial et restitution, scroll du body
 * verrouillé, portal vers document.body, voile aria-hidden non nommé.
 */
function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
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

    if (event.key === 'Tab' && panelRef.current) {
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navigation"
      onKeyDown={handleKeyDown}
    >
      {/* Voile : ferme au clic, invisible pour les lecteurs d'écran (le seul
          bouton « Fermer le menu » annoncé est celui du panneau). */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'var(--color-overlay)' }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-72 flex-col overflow-y-auto bg-[var(--color-surface)] p-4 outline-none"
        style={{ boxShadow: 'var(--shadow-3)' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Le mot-logo, identique à celui de la vitrine (StoreHeader) : « Istanbul »
 * en 800, « Fast Food » en 500, interlettrage à -0.03em. C'est le premier
 * élément que le gérant voit en basculant d'un côté à l'autre — s'il change
 * de dessin, les deux surfaces n'ont pas l'air d'appartenir au même produit.
 *
 * Seule l'exergue « Dashboard » s'ajoute ici, pour lever l'ambiguïté quand
 * les deux onglets sont ouverts côte à côte.
 */
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo height={compact ? 32 : 40} priority />
      <div>
        <p
          className={`whitespace-nowrap leading-none ${compact ? 'text-lg' : 'text-xl'}`}
          style={{
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.03em',
            color: 'var(--color-text)',
          }}
        >
          <span style={{ fontWeight: 800 }}>Istanbul</span>{' '}
          <span style={{ fontWeight: 500 }}>Fast Food</span>
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Dashboard
        </p>
      </div>
    </div>
  );
}

/**
 * État du service, à la place qu'occupait le sélecteur d'établissement.
 *
 * Ce n'est pas du remplissage : « est-ce qu'on prend encore des commandes ? »
 * est la question qu'on se pose vingt fois par service, et la réponse était
 * jusqu'ici enterrée dans la page Établissement. L'interrupteur reste sur la
 * vue d'ensemble — ici on informe, on ne bascule pas, pour qu'un clic distrait
 * dans la barre latérale ne coupe pas les ventes.
 */
function ServiceState() {
  const { restaurant: initial } = useRestaurantContext();
  // La fiche vient du cache React Query, amorcé par le provider : affichage
  // immédiat, et l'interrupteur de la vue d'ensemble se répercute ici sans
  // rechargement (les deux partagent la clé `restaurant`).
  const { data } = useRestaurantDetail(initial.id);
  const restaurant = data ?? initial;
  const accepting = restaurant.is_accepting_orders && restaurant.is_open;

  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor: 'var(--color-border)',
        background: accepting ? 'var(--color-success-soft)' : 'var(--color-surface-sunken)',
      }}
    >
      <p className="truncate text-sm font-semibold leading-tight" title={restaurant.name}>
        {restaurant.name}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: accepting ? 'var(--color-success)' : 'var(--color-text-muted)' }}
        />
        {accepting ? 'Commandes ouvertes' : 'Commandes fermées'}
      </p>
    </div>
  );
}

function UserFooter({
  profile,
  onSignOut,
}: {
  profile: { full_name: string; email: string | null } | null;
  onSignOut: () => void;
}) {
  return (
    <div className="mt-4 shrink-0 space-y-3 border-t border-[var(--color-border)] pt-4">
      {/* Le thème est une préférence, pas une commande de service : il tient
          sur une ligne étiquetée, à droite, comme dans un panneau de réglages.
          Il occupait jusqu'ici toute la largeur du pied de barre, au même
          poids visuel que la déconnexion. */}
      <div className="flex items-center justify-between gap-3 pl-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Apparence
        </span>
        <ThemeSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={profile?.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? '—'}</p>
          {/* L'e-mail plutôt que le rôle plateforme : c'est l'identifiant que
              le propriétaire saisira pour inviter quelqu'un, et le rôle dans
              l'établissement est déjà lisible dans le sélecteur. */}
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {profile?.email ?? ''}
          </p>
        </div>
      </div>

      {/* Vers la vitrine publique, qui occupe désormais la racine du site.
          Le gérant y va pour vérifier ce que le client voit après une
          modification de la carte — c'est un aller-retour constant. */}
      <Link
        href="/"
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-surface-sunken)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Storefront size={18} aria-hidden />
        Voir la vitrine
      </Link>

      <button
        onClick={onSignOut}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-danger-soft)]"
        style={{ color: 'var(--color-danger)' }}
      >
        <SignOut size={18} aria-hidden />
        Se déconnecter
      </button>
    </div>
  );
}
