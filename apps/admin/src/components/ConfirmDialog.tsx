'use client';

import { useState, type ReactNode } from 'react';
import { Button, Field, Modal, inputClass } from '@/components/ui';

/**
 * Boîte de confirmation, remplaçante des `confirm()` natifs.
 *
 * Le natif bloque le thread, n'est pas stylable et son libellé (« OK »)
 * n'explique pas ce qui va se passer. Ici : bouton destructif explicite,
 * champ « raison » optionnel (motif de refus d'une commande, par exemple)
 * et toute l'accessibilité héritée du Modal (Échap, piège de focus…).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = true,
  reasonLabel,
  reasonRequired = false,
  reasonPlaceholder,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true → bouton rouge (suppression, refus) ; false → bouton primaire. */
  destructive?: boolean;
  /** Fourni → affiche un textarea dont la valeur est passée à onConfirm. */
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  loading?: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (reasonLabel && reasonRequired && !trimmed) {
      setReasonError('Ce champ est obligatoire.');
      return;
    }
    setReasonError(null);
    onConfirm(reasonLabel ? trimmed || undefined : undefined);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-[var(--color-text-secondary)]">{message}</div>

        {reasonLabel ? (
          <Field label={reasonLabel} required={reasonRequired} error={reasonError ?? undefined}>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
            />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
