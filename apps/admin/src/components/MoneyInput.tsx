'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { inputClass } from '@/components/ui';

/**
 * Saisie monétaire : affichée en dollars, stockée en centimes.
 *
 * Factorise les huit duplications `value / 100` / `Math.round(... * 100)` des
 * formulaires. Le composant garde son propre texte pour laisser taper « 3, »
 * ou « 3.5 » sans que la conversion n'écrase la frappe ; l'arrondi ne se fait
 * qu'à la conversion vers les centimes (jamais de flottant persistant).
 */
export function MoneyInput({
  value,
  onChange,
  className = '',
  ...rest
}: {
  /** Montant en centimes ; null/undefined = champ vide. */
  value: number | null | undefined;
  /** Reçoit les centimes arrondis, ou null si le champ est vidé. */
  onChange: (cents: number | null) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(value == null ? '' : String(value / 100));

  // Resynchronise uniquement si la valeur externe diverge de la frappe en
  // cours (reset de formulaire) : « 3, » parse déjà à 300, on ne l'écrase pas.
  useEffect(() => {
    const parsed = parseToCents(text);
    if (parsed !== (value ?? null)) {
      setText(value == null ? '' : String(value / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- text volontairement hors deps
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={`${inputClass} ${className}`}
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        // Chiffres + un seul séparateur décimal (virgule ou point).
        if (!/^\d*(?:[.,]\d{0,2})?$/.test(raw)) return;
        setText(raw);
        onChange(parseToCents(raw));
      }}
      onBlur={(event) => {
        // Nettoie « 3, » → « 3 » à la sortie du champ.
        const cents = parseToCents(event.target.value);
        setText(cents == null ? '' : String(cents / 100));
        rest.onBlur?.(event);
      }}
    />
  );
}

/** Convertit la saisie en centimes de façon sûre (arrondi, jamais NaN). */
function parseToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const amount = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}
