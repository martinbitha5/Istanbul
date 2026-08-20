'use client';

import { forwardRef, type ReactNode } from 'react';

type AlertTone = 'danger' | 'warning' | 'success';

const TONES: Record<AlertTone, { bg: string; fg: string }> = {
  danger: { bg: 'var(--color-danger-soft)', fg: 'var(--color-on-danger-soft)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-on-warning-soft)' },
  success: { bg: 'var(--color-success-soft)', fg: 'var(--color-on-success-soft)' },
};

/**
 * Bandeau d'alerte inline.
 *
 * Factorise les copies dupliquées dans chaque page. `role="alert"` fait
 * annoncer le message dès son apparition ; le ref exposé permet d'y déplacer
 * le focus après une soumission échouée (tabIndex -1 pour être focusable
 * par script sans entrer dans l'ordre de tabulation).
 */
export const Alert = forwardRef<HTMLDivElement, {
  children: ReactNode;
  tone?: AlertTone;
  className?: string;
}>(function Alert({ children, tone = 'danger', className = '' }, ref) {
  const { bg, fg } = TONES[tone];
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={`rounded-xl px-4 py-3 text-sm outline-none ${className}`}
      style={{ background: bg, color: fg }}
    >
      {children}
    </div>
  );
});
