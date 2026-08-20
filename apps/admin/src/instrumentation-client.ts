import { setLogSink } from '@istanbul/core';

/**
 * Instrumentation navigateur.
 *
 * Même logique que les apps mobiles : sans DSN, aucun événement ne part ;
 * avec DSN, le logger structuré alimente Sentry (erreurs → événements,
 * info/warn → breadcrumbs).
 *
 * L'import est dynamique pour la même raison que côté serveur, avec un enjeu
 * différent : ici, `@sentry/nextjs` finissait dans le bundle *envoyé au
 * navigateur du gérant*, DSN ou pas. Une centaine de kilo-octets de
 * télémétrie éteinte sur le chemin critique d'un dashboard consulté depuis un
 * téléphone posé près de la caisse.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Une seule promesse d'import, partagée : le module ne se charge qu'une fois. */
const sentry = dsn ? import('@sentry/nextjs') : null;

if (sentry) {
  void sentry.then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });

    setLogSink((entry) => {
      if (entry.level === 'error') {
        if (entry.error instanceof Error) {
          Sentry.captureException(entry.error, {
            extra: { message: entry.message, ...entry.context },
          });
        } else {
          Sentry.captureMessage(entry.message, {
            level: 'error',
            extra: {
              ...entry.context,
              error: entry.error == null ? undefined : String(entry.error),
            },
          });
        }
        return;
      }

      Sentry.addBreadcrumb({
        level: entry.level === 'warn' ? 'warning' : 'info',
        message: entry.message,
        data: entry.context,
      });
    });
  });
}

/**
 * Navigation client → transaction Sentry.
 *
 * Next appelle ce hook de façon synchrone au départ d'une transition. Sans
 * DSN, on ne fait rien du tout ; avec, on attend l'import déjà lancé plus
 * haut — le décalage d'une microtâche est sans effet sur la mesure.
 */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
) {
  if (!sentry) return;
  void sentry.then((Sentry) => Sentry.captureRouterTransitionStart(...args));
}
