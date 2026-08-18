'use client';

import { useProfile } from '@istanbul/core';

const FALLBACK_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? '00000000-0000-0000-0000-000000000001';

/**
 * Restaurant courant.
 *
 * Le staff est rattaché à un restaurant via `profiles.restaurant_id`. Un
 * SUPER_ADMIN n'a pas de rattachement : on retombe alors sur le restaurant par
 * défaut, en attendant le sélecteur multi-restaurants du lot 4.
 */
export function useRestaurantId(): string {
  const { profile } = useProfile();
  return profile?.restaurant_id ?? FALLBACK_RESTAURANT_ID;
}
