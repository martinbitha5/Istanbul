import { useEffect, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Profile, UserRole } from '@istanbul/types';
import { getSupabase } from '../supabase/client';
import { fetchMyProfile } from '../api/auth';
import { queryKeys } from '../query/keys';

export interface SessionState {
  session: Session | null;
  /** true tant qu'on ne sait pas encore si l'utilisateur est connecté. */
  isLoading: boolean;
}

/**
 * Store de session partagé.
 *
 * Un seul abonnement `onAuthStateChange` pour toute l'application : chaque
 * appel de `useSession` lit le même instantané. L'ancienne version créait un
 * état local + un abonnement PAR hook monté ; comme `getSession()` est
 * asynchrone, chaque nouvel écran repartait de `session: null` et affichait un
 * flash « Connectez-vous » à l'utilisateur pourtant connecté.
 */
let snapshot: SessionState = { session: null, isLoading: true };
const listeners = new Set<() => void>();
const boundClients = new Set<QueryClient>();
let started = false;

function setSnapshot(next: SessionState) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function ensureStarted() {
  if (started) return;
  started = true;

  const supabase = getSupabase();

  void supabase.auth.getSession().then(({ data }) => {
    // Ne pas écraser un état déjà poussé par `onAuthStateChange`.
    if (snapshot.isLoading) {
      setSnapshot({ session: data.session, isLoading: false });
    }
  });

  supabase.auth.onAuthStateChange((event, nextSession) => {
    setSnapshot({ session: nextSession, isLoading: false });

    if (event === 'SIGNED_OUT') {
      // Purge totale : rien de l'utilisateur précédent ne doit survivre.
      boundClients.forEach((client) => client.clear());
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      boundClients.forEach((client) =>
        client.invalidateQueries({ queryKey: queryKeys.profile() }),
      );
    }
  });
}

function subscribe(listener: () => void): () => void {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
// Côté serveur (SSR du dashboard), la session n'est jamais connue du client JS.
const getServerSnapshot = (): SessionState => serverSnapshot;
const serverSnapshot: SessionState = { session: null, isLoading: true };

/**
 * Session Supabase.
 *
 * `isLoading` compte : sans lui, l'app affiche l'écran de connexion pendant
 * une fraction de seconde à chaque démarrage, même pour un utilisateur déjà
 * connecté. C'est le bug le plus visible d'une app mobile mal câblée.
 */
export function useSession(): SessionState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const queryClient = useQueryClient();

  // Enregistre le QueryClient pour les effets d'auth (purge à la déconnexion).
  useEffect(() => {
    boundClients.add(queryClient);
    return () => {
      boundClients.delete(queryClient);
    };
  }, [queryClient]);

  return state;
}

export function useProfile() {
  const { session, isLoading: sessionLoading } = useSession();

  const query = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchMyProfile,
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    profile: query.data ?? null,
    isLoading: sessionLoading || query.isLoading,
    isAuthenticated: !!session,
  };
}

export function useRole(): UserRole | null {
  const { profile } = useProfile();
  return profile?.role ?? null;
}

export function useIsStaff(): boolean {
  const role = useRole();
  return role === 'RESTAURANT_STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function useIsAdmin(): boolean {
  const role = useRole();
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// `Profile` n'est pas réexporté ici : l'index de `core` réexporte déjà
// `@istanbul/types` en entier, et deux `export *` portant le même nom
// rendraient l'export ambigu pour TypeScript.
