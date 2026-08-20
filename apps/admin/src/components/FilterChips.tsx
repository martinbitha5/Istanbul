'use client';

/**
 * Rangée de puces de filtre exclusives.
 *
 * Factorise le composant local de la page Menu et la copie inline de la page
 * Commandes. Le texte de la puce active utilise --color-text-on-primary :
 * en sombre, c'est de l'encre — plus jamais de blanc sur orange.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            // h-9 : 36 px de haut, 44 px de zone tactile avec le gap de 8 px
            // qui l'entoure. Sous cette taille, on rate la puce voisine.
            className="inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150"
            style={{
              background: active ? 'var(--color-primary)' : 'var(--color-surface)',
              color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
              borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
