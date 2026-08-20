'use client';

import { initials } from '@istanbul/core';

/**
 * Pastille d'initiales.
 *
 * Factorise les trois copies (Shell, livreurs, clients) : même fond
 * primary-soft partout pour que « qui est qui » se lise d'un coup d'œil.
 */
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        width: size,
        height: size,
        background: 'var(--color-primary-soft)',
        color: 'var(--color-on-primary-soft)',
      }}
    >
      {initials(name ?? undefined)}
    </div>
  );
}
