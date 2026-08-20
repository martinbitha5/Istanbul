import * as Sentry from '@sentry/react-native';
import { setLogSink } from '@istanbul/core';

/**
 * Sentry — activé seulement si un DSN est fourni. Sans DSN (dev local,
 * Expo Go), l'app tourne exactement pareil, sans télémétrie.
 *
 * Le logger structuré de `@istanbul/core` est branché dessus : les `log.error`
 * deviennent des événements, les `log.info/warn` des breadcrumbs qui donnent
 * le contexte au moment du crash.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initMonitoring(): void {
  if (initialized || !dsn) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
    // 10 % des sessions tracées : assez pour voir les écrans lents,
    // sans faire exploser le quota gratuit.
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
