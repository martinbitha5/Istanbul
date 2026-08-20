import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../supabase/client';

export interface CreateQueryClientOptions {
  /**
   * Appelé pour toute mutation qui échoue, avec un message déjà traduit.
   * C'est le filet global : brancher un toast ici garantit qu'aucune
   * mutation n'échoue en silence. Une mutation volontairement muette
   * (télémétrie, position GPS) se déclare avec `meta: { silent: true }`.
   */
  onMutationError?: (message: string, error: unknown) => void;
}

/**
 * Configuration React Query.
 *
 * Le contexte est un réseau mobile congolais : latence élevée, coupures
 * fréquentes. Les valeurs par défaut sont donc plus tolérantes que celles de
 * la bibliothèque, et on ne refetch pas au moindre retour au premier plan.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        options.onMutationError?.(toUserMessage(error), error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => {
          const code = (error as { code?: string })?.code;
          // Inutile de réessayer un refus de permission ou un 404.
          if (code === '42501' || code === 'PGRST301' || code === 'PGRST116') return false;
          // Ni une exception métier levée volontairement par une fonction SQL.
          if (code === 'P0001' || code === '23514') return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: false,
        networkMode: 'online',
      },
    },
  });
}

/** Extrait un message affichable depuis une erreur React Query. */
export function errorMessage(error: unknown): string {
  return toUserMessage(error);
}
