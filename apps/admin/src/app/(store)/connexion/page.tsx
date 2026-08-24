import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/store/AuthForm';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous ou créez votre compte pour commander.',
};

/**
 * Connexion et inscription, en une seule page.
 *
 * C'est le parti d'Uber Eats et il est demandé ici : on ne fait pas choisir
 * entre « se connecter » et « s'inscrire » avant de savoir qui est là. Le
 * client donne un téléphone ou un e-mail, et le compte est créé s'il n'existe
 * pas encore — la distinction n'a jamais eu de sens pour lui, seulement pour
 * le développeur.
 *
 * Bandeau noir en tête, colonne de 410 px centrée : les deux valeurs viennent
 * de la page d'origine.
 */
export default function ConnexionPage() {
  return (
    <>
      <header
        className="flex items-center px-6 md:px-10"
        style={{ background: 'var(--ue-surface-ink)', height: 88 }}
      >
        <div className="flex items-center gap-3">
          <Logo height={44} priority />
          <p
            className="text-2xl leading-none text-[var(--ue-ink-inverse)]"
            style={{ fontFamily: 'var(--ue-font-display)', letterSpacing: '-0.03em' }}
          >
            <span style={{ fontWeight: 800 }}>Istanbul</span>{' '}
            <span style={{ fontWeight: 500 }}>Fast Food</span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[410px] px-6 py-12 md:py-20">
        {/* useSearchParams (le `next` de retour) impose une frontière Suspense. */}
        <Suspense fallback={<div className="h-[420px]" aria-hidden />}>
          <AuthForm />
        </Suspense>
      </main>
    </>
  );
}
