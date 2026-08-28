'use client';

import { useEffect, useState } from 'react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';

type ThemeChoice = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Desktop },
];

/** Pas de nombre magique : le pas du curseur, c'est la largeur d'une cible. */
const CELL = 32;
const GAP = 2;

/**
 * Sélecteur de thème à trois états.
 *
 * Pose `data-theme` sur <html> et persiste dans localStorage. Le script
 * inline du layout racine relit cette valeur avant hydratation pour éviter
 * le flash de thème au chargement. « Système » supprime l'attribut : le
 * bloc `@media (prefers-color-scheme)` de globals.css reprend la main.
 *
 * Trois icônes dans une pilule, et un curseur blanc qui glisse de l'une à
 * l'autre — plutôt que trois boutons libellés sur toute la largeur, qui
 * pesaient dans le pied de la barre latérale autant que le compte et la
 * déconnexion réunis. Le libellé reste lu par les lecteurs d'écran et
 * apparaît en infobulle : c'est une préférence, pas une commande de service,
 * elle n'a pas à occuper une ligne entière.
 */
export function ThemeSwitcher({ className = '' }: { className?: string }) {
  // 'system' par défaut ; la vraie valeur est relue après montage pour ne pas
  // diverger du serveur (localStorage n'existe pas côté SSR).
  const [choice, setChoice] = useState<ThemeChoice>('system');
  // Le curseur ne doit pas glisser au premier rendu : sans ce drapeau, un
  // utilisateur en thème clair voit la pastille traverser la pilule au
  // chargement de chaque page.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') setChoice(stored);
    } catch {
      // localStorage indisponible (navigation privée stricte) : on reste sur système.
    }
    setReady(true);
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

  const index = OPTIONS.findIndex((option) => option.value === choice);

  return (
    <div
      role="group"
      aria-label="Thème de l’interface"
      className={`relative inline-flex shrink-0 items-center rounded-full p-1 ${className}`}
      style={{ background: 'var(--color-surface-sunken)', gap: GAP }}
    >
      {/* Le curseur : un seul élément qui se déplace, pas trois fonds qui
          s'allument. C'est ce glissement qui dit que les trois états sont
          exclusifs. */}
      <span
        aria-hidden
        className="absolute left-1 top-1 rounded-full"
        style={{
          width: CELL,
          height: CELL,
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-1)',
          transform: `translateX(${index * (CELL + GAP)}px)`,
          transition: ready ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        }}
      />

      {OPTIONS.map((option) => {
        const active = choice === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => apply(option.value)}
            aria-pressed={active}
            title={option.label}
            className="relative z-10 grid cursor-pointer place-items-center rounded-full transition-colors duration-200"
            style={{
              width: CELL,
              height: CELL,
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}
          >
            <Icon size={16} weight={active ? 'fill' : 'regular'} aria-hidden />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
