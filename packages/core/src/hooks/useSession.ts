import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
 * Session Supabase.
 *
 * `isLoading` compte : sans lui, l'app affiche l'écran de connexion pendant
 * une fraction de seconde à chaque démarrage, même pour un utilisateur déjà
 * connecté. C'est le bug le plus visible d'une app mobile mal câblée.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        // Purge totale : rien de l'utilisateur précédent ne doit survivre.
        queryClient.clear();
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { session, isLoading };
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
