'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Frontière d'erreur racine : capture les plantages du layout lui-même.
 * Doit rendre son propre <html>/<body> (le layout racine est hors-jeu ici),
 * d'où les styles inline — globals.css peut ne pas être chargé.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fffbf7',
          color: '#1a1613',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Une erreur est survenue</h1>
          <p style={{ marginTop: 12, fontSize: 14, color: '#5b5149' }}>
            Le dashboard n’a pas pu s’afficher. Réessayez ; si le problème persiste, rechargez la
            page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              height: 44,
              padding: '0 20px',
              borderRadius: 999,
              border: 'none',
              background: '#c4320f',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
