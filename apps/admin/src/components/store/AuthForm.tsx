'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppleLogo, ArrowLeft, GoogleLogo } from '@phosphor-icons/react';
import {
  isValidEmail,
  isValidPhone,
  requestPhoneOtp,
  toUserMessage,
  useSession,
  verifyPhoneOtp,
} from '@istanbul/core';
import { getBrowserClient } from '@/lib/supabase/client';

type Step = 'identify' | 'code' | 'mail-sent';

/**
 * Le formulaire d'identification.
 *
 * Un seul champ à l'entrée : le client tape ce qu'il a — un numéro ou une
 * adresse e-mail — et le code décide de la suite. C'est ce que fait Uber, et
 * à Kinshasa c'est le bon choix : beaucoup de clients n'ont pas de boîte mail
 * active, le téléphone est l'identifiant naturel.
 *
 *   téléphone → code à 6 chiffres par SMS (`signInWithOtp`, puis `verifyOtp`)
 *   e-mail    → lien magique (`signInWithOtp`), pas de mot de passe à retenir
 *
 * Dans les deux cas Supabase crée le compte s'il n'existe pas : la page sert
 * donc bien de connexion *et* d'inscription, sans que le client ait à choisir.
 *
 * Ce que ces boutons exigent côté Supabase — à activer dans le tableau de
 * bord du projet, sinon l'appel renvoie une erreur explicite affichée ici :
 * un fournisseur SMS (Twilio…) pour le téléphone, et les fournisseurs Google
 * et Apple pour les deux boutons du bas.
 */
export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { session } = useSession();

  const [step, setStep] = useState<Step>('identify');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `next` est fourni par le panier (« Commander ») ou par un lien protégé.
  // On n'accepte qu'un chemin interne : un `next` absolu serait une redirection
  // ouverte, de quoi expédier un client authentifié sur un site tiers.
  const rawNext = params.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/feed';

  // Déjà connecté (ou fraîchement identifié) : on file à destination.
  useEffect(() => {
    if (session) {
      router.replace(next);
      router.refresh();
    }
  }, [session, next, router]);

  const submitIdentifier = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const value = identifier.trim();

    if (isValidPhone(value)) {
      setBusy(true);
      try {
        getBrowserClient();
        await requestPhoneOtp(value);
        setStep('code');
      } catch (caught) {
        setError(toUserMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isValidEmail(value)) {
      setBusy(true);
      try {
        const supabase = getBrowserClient();
        const { error: caught } = await supabase.auth.signInWithOtp({
          email: value.toLowerCase(),
          options: {
            // Le lien reçu par mail ramène ici, qui redirige ensuite vers
            // `next` grâce à l'effet ci-dessus.
            emailRedirectTo: `${window.location.origin}/connexion?next=${encodeURIComponent(next)}`,
          },
        });
        if (caught) throw caught;
        setStep('mail-sent');
      } catch (caught) {
        setError(toUserMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    setError(
      'Saisissez un numéro congolais (0999 000 105) ou une adresse e-mail valide.',
    );
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await verifyPhoneOtp(identifier.trim(), code);
      // La redirection est prise en charge par l'effet sur `session`.
    } catch (caught) {
      setError(toUserMessage(caught));
      setBusy(false);
    }
  };

  const oauth = async (provider: 'google' | 'apple') => {
    setError(null);
    setBusy(true);

    try {
      const supabase = getBrowserClient();
      const { error: caught } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/connexion?next=${encodeURIComponent(next)}`,
        },
      });
      if (caught) throw caught;
      // Succès : le navigateur part chez le fournisseur, rien à faire ici.
    } catch (caught) {
      setError(toUserMessage(caught));
      setBusy(false);
    }
  };

  if (step === 'mail-sent') {
    return (
      <Notice
        title="Vérifiez votre boîte mail"
        body={`Un lien de connexion a été envoyé à ${identifier.trim()}. Ouvrez-le depuis cet appareil pour continuer.`}
        onBack={() => setStep('identify')}
      />
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={submitCode}>
        <BackButton onClick={() => setStep('identify')} />

        <h1 className="ue-h1 mt-4">Saisissez le code reçu</h1>
        <p className="mt-3 text-base text-[var(--ue-ink-secondary)]">
          Nous avons envoyé un code à 6 chiffres au {identifier.trim()}.
        </p>

        <input
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="ue-field mt-6 text-center text-2xl tracking-[0.4em]"
        />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <button
          type="submit"
          disabled={busy || code.length < 6}
          className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg mt-6"
        >
          {busy ? 'Vérification…' : 'Continuer'}
        </button>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={submitIdentifier}>
        <h1 className="ue-h1">Indiquez votre numéro de téléphone ou votre adresse e-mail</h1>

        <input
          autoFocus
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Saisir n° de tél. ou e-mail"
          autoComplete="username"
          className="ue-field mt-6"
        />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <button
          type="submit"
          disabled={busy || identifier.trim().length === 0}
          className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg mt-4"
        >
          {busy ? 'Un instant…' : 'Continuer'}
        </button>
      </form>

      <p className="ue-or my-6">ou</p>

      <button
        type="button"
        onClick={() => oauth('google')}
        disabled={busy}
        className="ue-btn ue-btn-secondary ue-btn-square ue-btn-lg"
      >
        <GoogleLogo size={20} weight="bold" aria-hidden />
        Continuer avec Google
      </button>

      <button
        type="button"
        onClick={() => oauth('apple')}
        disabled={busy}
        className="ue-btn ue-btn-secondary ue-btn-square ue-btn-lg mt-3"
      >
        <AppleLogo size={20} weight="fill" aria-hidden />
        Continuer avec Apple
      </button>

      <p className="mt-8 text-sm leading-5 text-[var(--ue-ink-secondary)]">
        Vous acceptez de recevoir un code de vérification par SMS. Des frais de messagerie
        peuvent s’appliquer.
      </p>

      <p className="mt-6 text-sm text-[var(--ue-ink-secondary)]">
        Vous faites partie de l’équipe ?{' '}
        <Link href="/admin/login" className="font-medium underline">
          Accès restaurant
        </Link>
      </p>
    </>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ue-close" aria-label="Revenir en arrière">
      <ArrowLeft size={20} aria-hidden />
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-sm font-medium" style={{ color: 'var(--ue-promo)' }}>
      {children}
    </p>
  );
}

function Notice({
  title,
  body,
  onBack,
}: {
  title: string;
  body: string;
  onBack: () => void;
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h1 className="ue-h1 mt-4">{title}</h1>
      <p className="mt-3 text-base text-[var(--ue-ink-secondary)]">{body}</p>
    </div>
  );
}
