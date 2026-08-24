'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modale de la vitrine — socle commun aux trois surfaces flottantes :
 * détails de livraison, fiche produit et panier.
 *
 * Elle apporte ce qu'une modale doit apporter et qu'on oublie une fois sur
 * deux : Échap ferme, le focus est piégé puis rendu à l'élément d'origine, le
 * corps de page ne défile plus derrière, et le voile est `aria-hidden` pour
 * qu'un lecteur d'écran n'annonce pas un bouton sans nom.
 *
 * `dismissible` à `false` retire la fermeture par Échap et par le voile : la
 * modale d'adresse en a besoin, tant qu'aucune adresse n'est saisie il n'y a
 * rien à voir derrière.
 */
export function StoreModal({
  open,
  onClose,
  label,
  placement = 'center',
  width = 'max-w-[560px]',
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** `center` pour les modales, `right` pour le panier en tiroir. */
  placement?: 'center' | 'right';
  /** Classe de largeur — les fiches produit sont bien plus larges. */
  width?: string;
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) return;

    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isDrawer = placement === 'right';

  return createPortal(
    <div
      // `data-surface` doit être reposé ici : le portal sort la modale de
      // l'arbre de la vitrine, et tout le thème (tokens `--ue-*` et classes
      // `.ue-*`) est porté par ce sélecteur. Sans lui, la modale s'affiche
      // sans fond ni rayon — le contenu de la page se lit au travers.
      data-surface="store"
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      />

      <div
        className={
          isDrawer
            ? 'absolute inset-y-0 right-0 flex'
            : 'absolute inset-0 flex items-center justify-center p-4'
        }
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={
            isDrawer
              ? `relative flex h-full w-screen flex-col bg-[var(--ue-surface)] outline-none ${width}`
              : `ue-modal relative flex max-h-[92dvh] w-full flex-col overflow-hidden outline-none ${width}`
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
