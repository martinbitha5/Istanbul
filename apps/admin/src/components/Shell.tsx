'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Buildings,
  ChartLineUp,
  ForkKnife,
  Gear,
  List,
  MapTrifold,
  Motorcycle,
  Receipt,
  SignOut,
  SquaresFour,
  Tag,
  UsersThree,
  Users,
  X,
} from '@phosphor-icons/react';
import { signOut, useProfile } from '@istanbul/core';
import { Avatar } from '@/components/Avatar';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { RestaurantSwitcher } from '@/components/RestaurantSwitcher';
import {
  useRestaurantAccess,
  useRestaurantContext,
  type RestaurantAccess,
} from '@/providers/RestaurantProvider';

/**
 * Navigation, groupée par intention.
 *
 * Onze entrées à plat, c'est une liste qu'on relit à chaque fois. Trois
 * groupes courts — ce que je fais maintenant, ce que je fais vendre, ce que
 * j'administre — se parcourent d'un coup d'œil, et les nouvelles pages
 * (équipe, établissement, partenaires) trouvent une place évidente plutôt
 * que d'allonger la liste.
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
      { href: '/', label: 'Vue d’ensemble', icon: ChartLineUp, need: 'view' },
      { href: '/orders', label: 'Commandes', icon: Receipt, need: 'view' },
    ],
  },
  {
    label: 'Carte',
    items: [
      { href: '/menu', label: 'Menu', icon: ForkKnife, need: 'manage' },
      { href: '/categories', label: 'Catégories', icon: SquaresFour, need: 'manage' },
      { href: '/promotions', label: 'Promotions', icon: Tag, need: 'manage' },
    ],
  },
  {
    label: 'Exploitation',
    items: [
      { href: '/drivers', label: 'Livreurs', icon: Motorcycle, need: 'manage' },
      { href: '/zones', label: 'Zones de livraison', icon: MapTrifold, need: 'manage' },
      { href: '/customers', label: 'Clients', icon: Users, need: 'view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/staff', label: 'Équipe', icon: UsersThree, need: 'admin' },
      { href: '/settings', label: 'Établissement', icon: Gear, need: 'admin' },
      { href: '/restaurants', label: 'Partenaires', icon: Buildings, need: 'platform' },
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
    router.replace('/login');
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
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-surface-sunken)]"
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
      <aside
        className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:flex"
        style={{ position: 'sticky', top: 0, height: '100dvh' }}
      >
        <Brand />
        <div className="mt-4">
          <RestaurantSwitcher />
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
            className="cursor-pointer rounded-full p-2 text-[var(--color-text-muted)]"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-4">
          <RestaurantSwitcher onNavigate={() => setDrawerOpen(false)} />
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <UserFooter profile={profile} onSignOut={handleSignOut} />
      </MobileDrawer>

      {/* --- Contenu ----------------------------------------------------- */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="cursor-pointer rounded-xl p-2"
            style={{ background: 'var(--color-surface)' }}
          >
            <List size={20} aria-hidden />
          </button>
          {/* En mobile, le nom de l'établissement remplace la marque : sur un
              compte multi-partenaires, savoir *où* l'on est prime sur savoir
              quelle application on utilise. */}
          <MobileTitle />
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

function MobileTitle() {
  const { restaurant } = useRestaurantContext();

  return (
    <span className="min-w-0">
      <span
        className="block truncate text-sm font-semibold leading-tight"
        style={{ color: 'var(--color-text)' }}
      >
        {restaurant?.name ?? 'Istanbul'}
      </span>
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        Dashboard
      </span>
    </span>
  );
}

function Brand() {
  return (
    <div>
      <p
        className="text-2xl leading-none tracking-tight"
        style={{ fontFamily: 'var(--font-playfair)', color: 'var(--color-primary)' }}
      >
        Istanbul
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        Dashboard
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
      <ThemeSwitcher />

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
