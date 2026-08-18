import { QueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../supabase/client';

/**
 * Configuration React Query.
 *
 * Le contexte est un réseau mobile congolais : latence élevée, coupures
 * fréquentes. Les valeurs par défaut sont donc plus tolérantes que celles de
 * la bibliothèque, et on ne refetch pas au moindre retour au premier plan.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
