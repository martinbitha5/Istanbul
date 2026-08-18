'use client';

import type { ReactNode } from 'react';
import type { StatusTone } from '@istanbul/types';

/**
 * Primitives du dashboard.
 *
 * Volontairement minimalistes : le dashboard est un outil de travail utilisé
 * huit heures par jour dans un restaurant, pas une vitrine. Densité élevée,
 * contraste franc, zéro fioriture.
 */

// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] ${
        padded ? 'p-5' : ''
      } ${className}`}
      style={{ boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-sora)' }}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-secondary)' },
  info: { bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  success: { bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  danger: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
}) {
  const { bg, fg } = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'text-white',
    secondary: 'border',
    ghost: '',
    danger: 'text-white',
  };

  const backgrounds: Record<ButtonVariant, string> = {
    primary: 'var(--color-primary)',
    secondary: 'transparent',
    ghost: 'transparent',
    danger: 'var(--color-danger)',
  };

  const colors: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: 'var(--color-text)',
    ghost: 'var(--color-primary)',
    danger: '#fff',
  };

  const inactive = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      title={title}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
        size === 'sm' ? 'h-9 px-3.5 text-sm' : 'h-11 px-5 text-sm'
      } ${styles[variant]} ${className}`}
      style={{
        background: inactive && variant !== 'ghost' ? 'var(--color-disabled)' : backgrounds[variant],
        color: inactive ? 'var(--color-disabled-text)' : colors[variant],
        borderColor: 'var(--color-border-strong)',
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

// ---------------------------------------------------------------------------

export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-[var(--color-danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition-colors ' +
  'border-[var(--color-border)] focus:border-[var(--color-primary)]';

// ---------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    // Le débordement horizontal reste dans le conteneur : la page elle-même
    // ne défile jamais latéralement.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`border-b border-[var(--color-border)] pb-2.5 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`border-b border-[var(--color-divider)] py-3 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Impossible de charger les données"
      description={message ?? 'Vérifiez votre connexion, puis réessayez.'}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        ) : undefined
      }
    />
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--color-skeleton)' }}
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Le voile assombrit assez pour isoler le contenu, et ferme au clic. */}
      <button
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--color-overlay)' }}
      />

      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-surface)] p-6 sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        style={{ boxShadow: 'var(--shadow-3)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)]"
          >
            ✕
          </button>
        </div>

        {children}

        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
      style={{ background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)' }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}
