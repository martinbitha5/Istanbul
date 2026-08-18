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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // On mémorise la destination pour y revenir après connexion.
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
