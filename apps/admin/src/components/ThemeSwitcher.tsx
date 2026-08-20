'use client';

import { useEffect, useState } from 'react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';

type ThemeChoice = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Desktop },
];

/**
 * Sélecteur de thème à trois états.
 *
 * Pose `data-theme` sur <html> et persiste dans localStorage. Le script
 * inline du layout racine relit cette valeur avant hydratation pour éviter
 * le flash de thème au chargement. « Système » supprime l'attribut : le
 * bloc `@media (prefers-color-scheme)` de globals.css reprend la main.
 */
export function ThemeSwitcher() {
  // 'system' par défaut ; la vraie valeur est relue après montage pour ne pas
  // diverger du serveur (localStorage n'existe pas côté SSR).
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') setChoice(stored);
    } catch {
      // localStorage indisponible (navigation privée stricte) : on reste sur système.
    }
  }, []);

  const apply = (value: ThemeChoice) => {
    setChoice(value);
    try {
      if (value === 'system') {
        localStorage.removeItem('theme');
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem('theme', value);
        document.documentElement.dataset.theme = value;
      }
    } catch {
      // Sans persistance, on applique quand même pour la session en cours.
      if (value === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = value;
    }
  };

  return (
    <div
      role="group"
      aria-label="Thème de l’interface"
      className="flex gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1"
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            onClick={() => apply(option.value)}
            aria-pressed={active}
            title={option.label}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: active ? 'var(--shadow-1)' : 'none',
            }}
          >
            <Icon size={14} weight={active ? 'fill' : 'regular'} aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
