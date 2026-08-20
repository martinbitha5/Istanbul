'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CaretUpDown, Check, Storefront } from '@phosphor-icons/react';
import { restaurantRoleLabel } from '@istanbul/types';
import { useRestaurantContext } from '@/providers/RestaurantProvider';

/**
 * Sélecteur d'établissement.
 *
 * Volontairement en haut de la sidebar, au-dessus de la navigation : c'est le
 * contexte de tout ce qui suit. Le mettre dans le pied de page — à côté du
 * profil, comme le font beaucoup de dashboards — laisse croire qu'il s'agit
 * d'un réglage de compte, et on finit par accepter une commande chez le
 * mauvais partenaire.
 *
 * Il disparaît quand l'utilisateur n'a qu'un établissement : un menu déroulant
 * à une entrée est un faux affordance.
 */
export function RestaurantSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { restaurant, restaurants, role, selectRestaurant } = useRestaurantContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Fermeture au clic extérieur : `pointerdown` et non `click`, sinon le clic
  // qui ouvre le menu le referme aussitôt sur certains navigateurs mobiles.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Focus sur l'option active à l'ouverture : le clavier reprend là où l'œil
  // se pose.
  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    (active ?? listRef.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open]);

  if (restaurants.length <= 1) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
        <Storefront size={18} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{restaurant?.name ?? '—'}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {role ? restaurantRoleLabel[role] : ''}
          </p>
        </div>
      </div>
    );
  }

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      containerRef.current?.querySelector('button')?.focus();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    options[(next + options.length) % options.length]?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--color-surface-sunken)]"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Storefront size={18} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{restaurant?.name ?? '—'}</span>
          <span className="block truncate text-xs text-[var(--color-text-muted)]">
            {role ? restaurantRoleLabel[role] : ''}
          </span>
        </span>
        <CaretUpDown size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
      </button>

      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Choisir un établissement"
          onKeyDown={handleListKeyDown}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-[var(--color-surface-raised)] p-1"
          style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-3)' }}
        >
          {restaurants.map((item) => {
            const selected = item.id === restaurant?.id;
            return (
              <div
                key={item.id}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                onClick={() => {
                  selectRestaurant(item.id);
                  setOpen(false);
                  onNavigate?.();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  selectRestaurant(item.id);
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150 hover:bg-[var(--color-surface-sunken)] focus-visible:bg-[var(--color-surface-sunken)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">
                    {restaurantRoleLabel[item.member_role]}
                    {item.is_published ? '' : ' · non publié'}
                  </span>
                </span>
                {selected ? (
                  <Check size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
