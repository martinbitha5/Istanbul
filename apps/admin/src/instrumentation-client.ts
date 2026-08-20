import * as Sentry from '@sentry/nextjs';
import { setLogSink } from '@istanbul/core';

/**
 * Instrumentation navigateur. Même logique que les apps mobiles : sans DSN,
 * aucun événement ne part ; avec DSN, le logger structuré alimente Sentry
 * (erreurs → événements, info/warn → breadcrumbs).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });

  setLogSink((entry) => {
    if (entry.level === 'error') {
      if (entry.error instanceof Error) {
        Sentry.captureException(entry.error, { extra: { message: entry.message, ...entry.context } });
      } else {
        Sentry.captureMessage(entry.message, {
          level: 'error',
          extra: { ...entry.context, error: entry.error == null ? undefined : String(entry.error) },
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
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
