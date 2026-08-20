'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui';

/**
 * Frontière d'erreur des routes : un rendu qui plante affiche un message
 * actionnable au lieu d'un écran blanc, et l'erreur part vers Sentry
 * (l'instrumentation est déjà initialisée dans instrumentation-client.ts).
 */
export default function RouteError({
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
    <main className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
          Une erreur est survenue
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          La page n’a pas pu s’afficher. Réessayez ; si le problème persiste, rechargez le
          navigateur ou vérifiez votre connexion.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>Réessayer</Button>
        </div>
      </div>
    </main>
  );
}
