import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Profile, Restaurant, RestaurantRole } from '@istanbul/types';

/**
 * Le type des cookies à poser est annoté à la main : `cookies` est une union
 * de deux formes dans @supabase/ssr (l'ancienne get/set/remove et la nouvelle
 * getAll/setAll), et TypeScript renonce au typage contextuel sur une union —
 * le paramètre retombe en `any` implicite, ce que `strict` refuse.
 */
type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Client Supabase côté serveur (Server Components, Route Handlers).
 *
 * Ne jamais y injecter la clé service_role : le dashboard s'appuie sur les
 * mêmes policies RLS que les apps mobiles. Un membre de l'équipe ne doit pas
 * pouvoir lire ce que son rôle lui interdit, même depuis le serveur.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Appelé depuis un Server Component : le middleware a déjà
            // rafraîchi la session, on peut ignorer sans risque.
          }
        },
      },
    },
  );
}

/** Ce que la coquille du dashboard doit savoir avant son premier rendu. */
export interface DashboardBootstrap {
  profile: Profile | null;
  restaurant: Restaurant | null;
  /** Rôle dans l'équipe, `null` pour un compte ADMIN non rattaché. */
  role: RestaurantRole | null;
  isAdmin: boolean;
}

/**
 * Amorçage du dashboard, en un seul aller-retour.
 *
 * L'ancienne version en enchaînait trois, dont le dernier après hydratation :
 * `auth.getUser()` (réseau), un `select` sur `profiles`, puis — côté
 * navigateur, une fois le JavaScript chargé — la liste des établissements, qui
 * bloquait l'écran derrière « Chargement de vos établissements… ». Sur un
 * réseau mobile à 300 ms de latence, cela faisait plus d'une seconde d'attente
 * avant le premier pixel utile, pour des données qui tiennent en une requête.
 *
 * On ne rappelle pas `auth.getUser()` : le middleware a déjà validé et
 * rafraîchi la session à cette navigation, et PostgREST revérifie le jeton de
 * toute façon. `fn_dashboard_bootstrap` renvoie un profil nul quand
 * `auth.uid()` l'est — c'est le signal de redirection vers la connexion.
 *
 * `cache` est celui de React : deux appels dans le même rendu (layout + page)
 * ne déclenchent qu'une requête.
 */
export const getDashboardBootstrap = cache(async (): Promise<DashboardBootstrap> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_dashboard_bootstrap');

  if (error || !data) {
    return { profile: null, restaurant: null, role: null, isAdmin: false };
  }

  const payload = data as {
    profile: Profile | null;
    restaurant: Restaurant | null;
    role: RestaurantRole | null;
    is_admin: boolean;
  };

  return {
    profile: payload.profile,
    restaurant: payload.restaurant,
    role: payload.role,
    isAdmin: payload.is_admin === true,
  };
});
