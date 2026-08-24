'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import type { StatusTone } from '@istanbul/types';

/**
 * Primitives du dashboard.
 *
 * Même charte que la vitrine (voir store.css) : encre et papier, rayon de
 * 8 px, boutons pilule, accent vert réservé aux signaux positifs. Ce qui
 * change côté backoffice, c'est la densité — le gérant passe huit heures
 * dessus, les tailles et les espacements sont plus serrés que sur la
 * vitrine, où chaque plat a droit à sa photo.
 */

// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    // Une carte Uber tient par son ombre, pas par un cadre : le filet reste
    // sur `divider` (#EEE, leur trait de séparation) et non sur `border`, qui
    // redessinerait la boîte que l'ombre suffit à poser.
    <div
      className={`rounded-lg border border-[var(--color-divider)] bg-[var(--color-surface)] ${
        padded ? 'p-5' : ''
      } ${className}`}
      style={{ boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  as: Heading = 'h2',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** `h1` pour le titre principal de la page : chaque page doit en avoir un. */
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* 700 et -0.02em : la tenue des titres de la vitrine (`.ue-h3`),
            Figtree étant plus large qu'UberMove sans ce resserrement. */}
        <Heading
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------

// Texte sur fond soft : les tokens on-*-soft garantissent 4.5:1, là où la
// couleur pleine ne tenait pas le contraste sur le pastel.
const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-secondary)' },
  info: { bg: 'var(--color-info-soft)', fg: 'var(--color-on-info-soft)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-on-warning-soft)' },
  success: { bg: 'var(--color-success-soft)', fg: 'var(--color-on-success-soft)' },
  danger: { bg: 'var(--color-danger-soft)', fg: 'var(--color-on-danger-soft)' },
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
}) {
  const { bg, fg } = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  // Les quatre boutons d'Uber : encre plein, gris plein, fantôme, et le rouge
  // des actions destructrices. Le fond au repos et le fond au survol passent
  // par deux variables CSS plutôt que par `style={{ background }}` : une
  // valeur inline l'emporterait sur `hover:`, et on retomberait sur le
  // `opacity-90` d'avant, qui délavait le texte en même temps que le fond.
  const VARIANTS: Record<ButtonVariant, { bg: string; hover: string; fg: string }> = {
    primary: {
      bg: 'var(--color-primary)',
      hover: 'var(--color-primary-pressed)',
      fg: 'var(--color-text-on-primary)',
    },
    secondary: {
      bg: 'var(--color-surface-muted)',
      hover: 'var(--color-border-strong)',
      fg: 'var(--color-text)',
    },
    ghost: {
      bg: 'transparent',
      hover: 'var(--color-surface-sunken)',
      fg: 'var(--color-text)',
    },
    danger: {
      bg: 'var(--color-danger)',
      hover: 'var(--color-danger-pressed)',
      fg: 'var(--color-text-inverse)',
    },
  };

  const inactive = disabled || loading;
  const { bg, hover, fg } = VARIANTS[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      title={title}
      aria-busy={loading}
      // 200ms sur le seul fond, comme `.ue-btn` : pas de fondu d'opacité, pas
      // de changement de taille. Le poids reste sur 500 (font-medium), la
      // graisse des boutons Uber.
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] font-medium transition-colors duration-200 hover:bg-[var(--btn-hover)] disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-9 px-4 text-sm' : 'h-11 px-5 text-sm'
      } ${className}`}
      style={
        {
          '--btn-bg': inactive && variant !== 'ghost' ? 'var(--color-disabled)' : bg,
          '--btn-hover': inactive ? 'var(--color-disabled)' : hover,
          color: inactive ? 'var(--color-disabled-text)' : fg,
        } as React.CSSProperties
      }
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

// ---------------------------------------------------------------------------

/**
 * Champ de formulaire avec libellé, hint et erreur accessibles.
 *
 * Le hint et l'erreur sont sortis du `<label>` (un lecteur d'écran lisait
 * tout le bloc comme libellé) : `htmlFor` + `useId` relient le libellé au
 * champ, et le champ enfant reçoit `aria-invalid` / `aria-describedby` par
 * clonage quand c'est un élément unique.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const id = useId();
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  // Injecte id + attributs ARIA sur le champ s'il est un élément React unique
  // (input, select, textarea, MoneyInput…). Un enfant composite reste intact.
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': messageId,
      })
    : children;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
      >
        {label}
        {required ? (
          <span className="text-[var(--color-danger)]" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>
      {child}
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-[var(--color-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  // Le champ d'Uber : fond gris, aucun cadre au repos, rayon 8. La bordure
  // n'est pas absente mais transparente — sans elle, l'apparition du filet
  // noir au focus décalerait le contenu d'un pixel.
  //
  // `min-h-11` : 44 px, la cible tactile minimale — et sur iOS un champ de
  // moins de 16 px de texte déclenche un zoom automatique, d'où `text-base`
  // sous 640 px.
  'w-full min-h-11 rounded-lg border border-transparent bg-[var(--color-surface-sunken)] px-4 py-2.5 text-base sm:text-sm ' +
  'outline-none transition-colors duration-200 ' +
  'placeholder:text-[var(--color-text-secondary)] ' +
  'hover:bg-[var(--color-surface-muted)] focus:border-[var(--color-text)] focus:bg-[var(--color-surface)] ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--color-disabled)] disabled:text-[var(--color-disabled-text)] ' +
  'read-only:bg-[var(--color-disabled)] ' +
  'aria-[invalid=true]:border-[var(--color-danger)]';

// ---------------------------------------------------------------------------

export function Table({
  children,
  responsive = false,
  ariaLabel,
}: {
  children: ReactNode;
  /**
   * Sous 768 px, chaque ligne devient une carte de paires libellé/valeur
   * (les libellés viennent de la prop `label` des <Td>). À réserver aux
   * écrans consultés en mobilité (commandes, livreurs).
   */
  responsive?: boolean;
  /** Nom de la zone défilante pour la navigation clavier. */
  ariaLabel?: string;
}) {
  return (
    // Le débordement horizontal reste dans le conteneur : la page elle-même
    // ne défile jamais latéralement. tabIndex + role region rendent la zone
    // défilante atteignable et nommée au clavier.
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={ariaLabel ?? 'Tableau'}
    >
      {/* Survol de ligne : sur un tableau dense de dix colonnes, l'œil perd
          la ligne entre le nom et le montant. Le fond `sunken` la retient
          sans ajouter de bordure ni décaler quoi que ce soit. */}
      <table
        className={`w-full border-collapse text-sm [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-[var(--color-surface-sunken)] ${
          responsive ? 'rt-cards md:min-w-[720px]' : 'min-w-[720px]'
        }`}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`border-b border-[var(--color-border)] pb-2.5 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

/**
 * En-tête de colonne triable.
 *
 * `aria-sort` porte l'information pour les lecteurs d'écran ; la flèche la
 * porte pour les autres. Aucune des deux n'est facultative : sans `aria-sort`
 * un tableau trié est indiscernable d'un tableau qui ne l'est pas, et sans
 * flèche rien n'indique qu'on peut cliquer.
 *
 * Le tri est purement local — les listes du dashboard sont déjà chargées en
 * entier. Un tri serveur rajouterait un aller-retour réseau là où il n'y a
 * que quelques centaines de lignes.
 */
export function SortableTh<K extends string>({
  children,
  sortKey,
  state,
  onSort,
  align = 'left',
}: {
  children: ReactNode;
  sortKey: K;
  state: SortState<K>;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
}) {
  const active = state.key === sortKey;
  const direction = active ? state.direction : null;

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`border-b border-[var(--color-border)] pb-2.5 pt-1 text-xs font-semibold uppercase tracking-wide ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      style={{ color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide transition-colors duration-150 hover:text-[var(--color-text)] ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {children}
        <span aria-hidden className="text-[10px] leading-none">
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export interface SortState<K extends string> {
  key: K;
  direction: 'asc' | 'desc';
}

/**
 * État de tri d'un tableau.
 *
 * Recliquer sur la colonne active inverse le sens ; changer de colonne
 * repart en descendant — sur un dashboard, la question est presque toujours
 * « qui est en haut ? », pas « qui est en bas ? ».
 */
export function useSort<Row, K extends string>(
  initial: SortState<K>,
  /** Extrait la valeur comparable d'une ligne pour la colonne demandée. */
  pick: (row: Row, key: K) => string | number | null | undefined,
) {
  const [state, setState] = useState<SortState<K>>(initial);

  const onSort = (key: K) =>
    setState((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );

  const sort = (rows: Row[]): Row[] =>
    [...rows].sort((a, b) => {
      const left = pick(a, state.key);
      const right = pick(b, state.key);
      const sign = state.direction === 'asc' ? 1 : -1;

      // Les valeurs absentes tombent toujours en bas, quel que soit le sens :
      // remonter les « — » en tête d'un tri décroissant n'aide personne.
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * sign;
      }
      return String(left).localeCompare(String(right), 'fr') * sign;
    });

  return { state, onSort, sort };
}

export function Td({
  children,
  align = 'left',
  className = '',
  label,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** Libellé affiché en mode carte (Table `responsive`) sous 768 px. */
  label?: string;
}) {
  return (
    <td
      data-label={label}
      className={`border-b border-[var(--color-divider)] py-3 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <h3
        className="text-lg font-bold"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Impossible de charger les données"
      description={message ?? 'Vérifiez votre connexion, puis réessayez.'}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        ) : undefined
      }
    />
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--color-skeleton)' }}
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modale accessible.
 *
 * - Échap ferme, Tab cycle à l'intérieur (piège de focus) ;
 * - focus initial sur le panneau, restitué à l'élément déclencheur à la
 *   fermeture ;
 * - `aria-labelledby` pointe le h2 ; un seul bouton nommé « Fermer » (le
 *   voile ferme au clic mais reste invisible pour les lecteurs d'écran) ;
 * - scroll du body verrouillé, rendu dans un portal vers document.body pour
 *   échapper aux contextes d'empilement des pages.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus initial + restitution + verrouillage du scroll du body.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    // Piège de focus : Tab cycle entre les éléments focusables du panneau.
    if (event.key === 'Tab' && panelRef.current) {
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      {/* Le voile ferme au clic mais n'est pas un bouton nommé : le seul
          « Fermer » annoncé est celui du panneau. */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'var(--color-overlay)' }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--color-surface)] p-6 outline-none sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        style={{ boxShadow: 'var(--shadow-3)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h2>
          {/* Icône vectorielle et non le caractère « ✕ » : le glyphe dépend
              de la police installée et se rendait différemment d'un poste à
              l'autre, sans jamais s'aligner sur le titre. */}
          {/* Le bouton rond gris des modales Uber (`.ue-close`). Il reste à
              droite et non à gauche comme chez eux : dix écrans du dashboard
              ferment déjà de ce côté. */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="-m-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-surface-muted)]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {children}

        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    // La zone tactile fait 44 px (p-2 autour du rail de 24 px) sans que le
    // rail lui-même grossisse : sur un téléphone, l'interrupteur d'un
    // formulaire à dix lignes est la cible qu'on rate le plus souvent.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="-m-2 shrink-0 cursor-pointer rounded-full p-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden
        className="relative block h-6 w-11 rounded-full transition-colors duration-150"
        style={{
          background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)',
        }}
      >
        {/* Pastille en `surface` et non en blanc dur : sur le rail orange
            clair du thème sombre, un blanc pur écrasait le contraste. */}
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full transition-transform duration-150"
          style={{
            background: 'var(--color-surface)',
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
            boxShadow: 'var(--shadow-1)',
          }}
        />
      </span>
    </button>
  );
}
