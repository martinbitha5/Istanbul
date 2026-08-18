import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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
 * mêmes policies RLS que les apps mobiles. Un membre du staff ne doit pas
 * pouvoir lire les données d'un autre restaurant, même depuis le serveur.
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

/** Profil de l'utilisateur connecté, ou null. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  return data;
}
