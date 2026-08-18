'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartLineUp,
  ForkKnife,
  List,
  MapTrifold,
  Motorcycle,
  Receipt,
  SignOut,
  SquaresFour,
  Tag,
  Users,
  X,
} from '@phosphor-icons/react';
import { initials, signOut, useProfile } from '@istanbul/core';

const NAV = [
  { href: '/', label: 'Vue d’ensemble', icon: ChartLineUp },
  { href: '/orders', label: 'Commandes', icon: Receipt },
  { href: '/menu', label: 'Menu', icon: ForkKnife },
  { href: '/categories', label: 'Catégories', icon: SquaresFour },
  { href: '/drivers', label: 'Livreurs', icon: Motorcycle },
  { href: '/customers', label: 'Clients', icon: Users },
  { href: '/promotions', label: 'Promotions', icon: Tag },
  { href: '/zones', label: 'Zones de livraison', icon: MapTrifold },
] as const;

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
    router.refresh();
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Navigation principale">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? 'page' : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: active ? 'var(--color-primary-soft)' : 'transparent',
              color: active ? 'var(--color-on-primary-soft)' : 'var(--color-text-secondary)',
            }}
          >
            <Icon size={20} weight={active ? 'fill' : 'regular'} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* --- Sidebar (desktop) ------------------------------------------ */}
      <aside
        className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:flex"
        style={{ position: 'sticky', top: 0, height: '100dvh' }}
      >
        <Brand />
        <div className="mt-6 flex-1">{nav}</div>
        <UserFooter profile={profile} onSignOut={handleSignOut} />
      </aside>

      {/* --- Tiroir (mobile) -------------------------------------------- */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0"
            style={{ background: 'var(--color-overlay)' }}
          />
          <div
            className="relative flex h-full w-72 flex-col bg-[var(--color-surface)] p-4"
            style={{ boxShadow: 'var(--shadow-3)' }}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-full p-2 text-[var(--color-text-muted)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex-1">{nav}</div>
            <UserFooter profile={profile} onSignOut={handleSignOut} />
          </div>
        </div>
      ) : null}

      {/* --- Contenu ----------------------------------------------------- */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-xl p-2"
            style={{ background: 'var(--color-surface)' }}
          >
            <List size={20} />
          </button>
          <span style={{ fontFamily: 'var(--font-playfair)', color: 'var(--color-primary)' }}>
            Istanbul
          </span>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
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
  profile: { full_name: string; role: string } | null;
  onSignOut: () => void;
}) {
  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-on-primary-soft)' }}
        >
          {initials(profile?.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? '—'}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{profile?.role ?? ''}</p>
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
        style={{ color: 'var(--color-danger)' }}
      >
        <SignOut size={18} />
        Se déconnecter
      </button>
    </div>
  );
}
