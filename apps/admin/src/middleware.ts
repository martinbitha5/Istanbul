import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Voir lib/supabase/server.ts : le typage contextuel ne traverse pas l'union
// de formes de `cookies`, il faut annoter le paramètre à la main.
type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Middleware d'authentification.
 *
 * Deux rôles : rafraîchir le token Supabase à chaque navigation (sinon la
 * session expire silencieusement au bout d'une heure), et rediriger vers la
 * connexion si l'utilisateur n'est pas authentifié.
 *
 * Le contrôle de rôle (staff / admin) reste côté RLS : ce middleware ne fait
 * que de l'aiguillage, il n'est pas une barrière de sécurité.
 */
export async function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Aucun cookie de session : inutile de construire un client Supabase et
  // d'aller interroger le serveur d'authentification pour se faire répondre
  // « personne ». C'est le cas de tout premier chargement du dashboard, et
  // celui où l'on peut le moins se permettre un aller-retour de plus.
  if (!hasAuthCookie(request)) {
    return isLoginPage ? NextResponse.next({ request }) : redirectToLogin(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /**
   * `getClaims` plutôt que `getUser`.
   *
   * Les deux valident le jeton et rafraîchissent la session au passage —
   * `getClaims` commence par `getSession()`, qui déclenche le renouvellement
   * et la réécriture des cookies. La différence est le coût : quand le projet
   * signe ses jetons en asymétrique, la vérification se fait localement contre
   * la clé publique, sans appeler le serveur d'authentification. `getUser`,
   * lui, part sur le réseau à *chaque* navigation, et ce round-trip s'ajoutait
   * en tête de chaque page du dashboard.
   *
   * En signature symétrique (HS256), la bibliothèque retombe d'elle-même sur
   * `getUser` : jamais moins sûr, souvent plus rapide.
   */
  const {
    data: claims,
    error,
  } = await supabase.auth.getClaims();

  const authenticated = !error && !!claims?.claims?.sub;

  if (!authenticated && !isLoginPage) return redirectToLogin(request);

  if (authenticated && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

/** Cookie de session posé par @supabase/ssr : `sb-<ref>-auth-token[.n]`. */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  // On mémorise la destination pour y revenir après connexion.
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // `_next/*` en entier, pas seulement `static` : les requêtes de données de
  // navigation client (`_next/data`) déclenchaient elles aussi une validation
  // de session, alors que la page qu'elles servent la refait de son côté.
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
