import Link from 'next/link';

/**
 * Page 404 : un lien de retour clair plutôt que la page par défaut de Next.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <p
          className="text-5xl font-bold tracking-tight text-[var(--color-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          404
        </p>
        <h1 className="display mt-4 text-xl">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Cette page n’existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold"
          style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}
        >
          Retour à la vue d’ensemble
        </Link>
      </div>
    </main>
  );
}
