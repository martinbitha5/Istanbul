import * as Sentry from '@sentry/nextjs';

/**
 * Instrumentation serveur (Node + Edge) — chargée automatiquement par Next.
 * Sans DSN, tout reste inerte : le dashboard tourne sans télémétrie.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
