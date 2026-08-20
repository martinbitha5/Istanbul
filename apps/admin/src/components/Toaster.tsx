'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';

/**
 * Système de toasts du dashboard.
 *
 * Deux voies d'accès :
 *   - `useToast()` dans les composants React ;
 *   - `toastRef.current` hors React (branché sur `onMutationError` du
 *     queryClient dans providers.tsx — le filet global qui garantit qu'aucune
 *     mutation n'échoue en silence).
 *
 * La pile est en bas à droite sur desktop, en haut sur mobile (le pouce du
 * gérant occupe le bas de l'écran du téléphone posé près de la caisse).
 * `aria-live="polite"` annonce les messages sans voler le focus.
 */

type ToastKind = 'success' | 'error' | 'info';

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  leaving: boolean;
}

/**
 * Ref module-scope alimentée par le provider : permet à du code hors React
 * (le mutationCache de React Query) d'émettre un toast.
 */
export const toastRef: { current: ToastApi | null } = { current: null };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return api;
}

// Les erreurs restent plus longtemps : on doit pouvoir les lire en plein rush.
const DISMISS_MS: Record<ToastKind, number> = { success: 3500, info: 3500, error: 5000 };
const EXIT_MS = 200;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    // Deux temps : on marque « leaving » pour jouer l'animation de sortie,
    // puis on retire vraiment l'élément.
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
    );
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message, leaving: false }]);
      const timer = setTimeout(() => {
        timers.current.delete(id);
        remove(id);
      }, DISMISS_MS[kind]);
      timers.current.set(id, timer);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  useEffect(() => {
    toastRef.current = api;
    const pending = timers.current;
    return () => {
      toastRef.current = null;
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* aria-live annonce chaque nouveau toast sans déplacer le focus. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLE: Record<ToastKind, { bg: string; fg: string; icon: ReactNode }> = {
  success: {
    bg: 'var(--color-success-soft)',
    fg: 'var(--color-on-success-soft)',
    icon: <CheckCircle size={18} weight="fill" />,
  },
  error: {
    bg: 'var(--color-danger-soft)',
    fg: 'var(--color-on-danger-soft)',
    icon: <WarningCircle size={18} weight="fill" />,
  },
  info: {
    bg: 'var(--color-info-soft)',
    fg: 'var(--color-on-info-soft)',
    icon: <Info size={18} weight="fill" />,
  },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const style = KIND_STYLE[toast.kind];

  return (
    <div
      // role différencié : une erreur est annoncée immédiatement.
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm ${
        toast.leaving ? 'toast-exit' : 'toast-enter'
      }`}
      style={{ boxShadow: 'var(--shadow-2)' }}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: style.bg, color: style.fg }}
        aria-hidden
      >
        {style.icon}
      </span>
      <p className="min-w-0 flex-1 pt-0.5 text-[var(--color-text)]">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label="Fermer la notification"
        className="shrink-0 rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)]"
      >
        ✕
      </button>
    </div>
  );
}
