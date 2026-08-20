/**
 * Journalisation structurée.
 *
 * Un seul point de passage pour tous les logs applicatifs :
 *   - en dev, sortie console lisible ;
 *   - en prod, chaque entrée est aussi transmise au « sink » enregistré par
 *     l'application (Sentry), avec son contexte.
 *
 * On ne journalise jamais de données personnelles (téléphone, adresse) :
 * un identifiant suffit à retrouver la ligne en base.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

type LogSink = (entry: LogEntry) => void;

let sink: LogSink | null = null;

/** Branché au démarrage de l'app (ex. vers Sentry). */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
  const line = context ? `${message} ${JSON.stringify(context)}` : message;

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      if (typeof __DEV__ === 'undefined' || __DEV__) console.debug(`[istanbul] ${line}`);
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(`[istanbul] ${line}`);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(`[istanbul] ${line}`);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(`[istanbul] ${line}`, error ?? '');
      break;
  }

  try {
    sink?.({ level, message, context, error });
  } catch {
    // Un sink qui casse ne doit jamais casser l'app.
  }
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
    emit('error', message, context, error),
};

declare const __DEV__: boolean | undefined;
