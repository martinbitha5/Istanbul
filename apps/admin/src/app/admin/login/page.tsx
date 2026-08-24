'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmail, toUserMessage } from '@istanbul/core';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { Alert } from '@/components/Alert';
import { getBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      getBrowserClient();
      await signInWithEmail(email, password);
      // refresh() force le middleware à relire le cookie de session fraîchement
      // posé — sans lui, la première navigation reboucle sur /login.
      // Défaut `/admin` et non `/` : la racine est désormais la vitrine
      // publique, pas le dashboard.
      router.replace((params.get('redirect') as never) ?? '/admin');
      router.refresh();
      // Pas de setSubmitting(false) ici : le spinner doit tenir jusqu'à ce que
      // la navigation démonte cette page. L'arrêter dès la réponse de Supabase
      // laissait un bouton inerte pendant tout le rendu de la destination —
      // l'utilisateur croyait que « ça ne faisait rien » et recliquait.
    } catch (caught) {
      setError(toUserMessage(caught));
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* Le logo est le titre principal de la page de connexion. */}
          <h1
            className="text-3xl font-extrabold tracking-tighter"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}
          >
            Istanbul
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            Dashboard restaurant
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                autoComplete="email"
                required
                placeholder="cuisine@istanbulfastfood.cd"
              />
            </Field>

            <Field label="Mot de passe" required>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>

            {error ? <Alert>{error}</Alert> : null}

            <Button type="submit" loading={submitting} className="w-full">
              Se connecter
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
          Accès réservé au personnel du restaurant.
        </p>
      </div>
    </main>
  );
}
