/**
 * Instrumentation serveur (Node + Edge) — chargée automatiquement par Next.
 *
 * `@sentry/nextjs` n'est **pas** importé au niveau du module, et c'est
 * délibéré : côté serveur, il tire tout OpenTelemetry derrière lui. Sans DSN
 * — le cas par défaut, et celui du développement — on payait ce chargement à
 * chaque démarrage et à chaque recompilation pour un `if (!dsn) return`
 * immédiat. L'import dynamique le réserve aux instances qui envoient
 * réellement de la télémétrie.
 *
 * Effet de bord bienvenu : `import-in-the-middle` et `require-in-the-middle`,
 * qu'OpenTelemetry charge et que Next traite comme paquets externes, ne sont
 * plus sollicités quand Sentry est éteint. (Ils sont par ailleurs déclarés en
 * dépendances du dashboard — sous pnpm, un paquet externe doit être résolvable
 * depuis le dossier de l'app, ce que l'arbre strict ne garantissait pas.)
 */

function dsn(): string | undefined {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export async function register() {
  if (!dsn()) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: dsn(),
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/**
 * Erreurs non rattrapées des Server Components et Route Handlers.
 *
 * Next appelle ce hook avec sa propre signature ; on la reprend depuis le SDK
 * plutôt que de la retaper, pour qu'une évolution de Next fasse échouer le
 * typecheck ici et non silencieusement à l'exécution.
 */
export const onRequestError: typeof import('@sentry/nextjs').captureRequestError = async (
  ...args
) => {
  if (!dsn()) return;

  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
};
