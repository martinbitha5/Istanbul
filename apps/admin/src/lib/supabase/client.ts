'use client';

import { createBrowserClient } from '@supabase/ssr';
import { setSupabaseClient } from '@istanbul/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur.
 *
 * On enregistre l'instance dans `@istanbul/core` pour que tous les hooks
 * partagés (les mêmes que les apps mobiles) fonctionnent sans adaptation.
 */
let browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase n'est pas configuré. Renseignez NEXT_PUBLIC_SUPABASE_URL et " +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY dans apps/admin/.env.local.',
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  setSupabaseClient(browserClient);
  return browserClient;
}
