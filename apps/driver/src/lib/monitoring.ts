import * as Sentry from '@sentry/react-native';
import { setLogSink } from '@istanbul/core';

/**
 * Sentry — activé seulement si un DSN est fourni. Voir apps/client pour la
 * logique ; ici seul l'environnement diffère (app livreur).
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initMonitoring(): void {
  if (initialized || !dsn) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
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
