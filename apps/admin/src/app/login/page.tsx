'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmail, toUserMessage } from '@istanbul/core';
import { Button, Card, Field, inputClass } from '@/components/ui';
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
      router.replace((params.get('redirect') as never) ?? '/');
      router.refresh();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--color-primary)' }}
          >
            Istanbul
          </p>
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

            {error ? (
              <div
                role="alert"
                className="rounded-xl px-3.5 py-2.5 text-sm"
                style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
              >
                {error}
              </div>
            ) : null}

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
