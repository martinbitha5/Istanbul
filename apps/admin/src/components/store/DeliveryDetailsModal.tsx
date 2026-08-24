'use client';

import { useEffect, useState } from 'react';
import { CaretDown, Clock, MapPin, X } from '@phosphor-icons/react';
import { CommunesDatalist } from '@/components/store/AddressSearch';
import { SLOT_OPTIONS } from '@/components/store/slots';
import { setDeliveryPrefs, useDeliveryPrefs } from '@/lib/delivery-prefs';
import { StoreModal } from '@/components/store/StoreModal';

/**
 * « Détails de la livraison » et « Choisissez une heure ».
 *
 * Deux écrans dans une seule modale, comme chez Uber Eats : l'adresse et le
 * créneau d'abord, la planification derrière le bouton « Planifier ». Le
 * retour se fait par « Livrer maintenant » ou par la validation du créneau —
 * il n'y a pas de flèche retour dans l'original non plus.
 *
 * `required` est le cas d'entrée : quand le visiteur arrive sur la carte sans
 * adresse, la modale s'ouvre d'elle-même et ne se ferme pas tant qu'il n'a
 * rien saisi. C'est ce qui garantit qu'aucun plat n'est présenté avant qu'on
 * sache si on peut le livrer.
 */
export function DeliveryDetailsModal({
  open,
  onClose,
  required = false,
}: {
  open: boolean;
  onClose: () => void;
  required?: boolean;
}) {
  const prefs = useDeliveryPrefs();

  const [step, setStep] = useState<'details' | 'time'>('details');
  const [editingAddress, setEditingAddress] = useState(false);
  const [draft, setDraft] = useState('');
  const [slotId, setSlotId] = useState<string>('now');

  // À chaque ouverture on repart de l'état réel : sinon la modale rouvre sur
  // le brouillon abandonné la fois précédente.
  useEffect(() => {
    if (!open) return;
    setStep('details');
    setDraft(prefs.address ?? '');
    setEditingAddress(required || !prefs.address);
    setSlotId(prefs.slot ? (SLOT_OPTIONS.find((s) => s.label === prefs.slot)?.id ?? 'now') : 'now');
  }, [open, prefs.address, prefs.slot, required]);

  const trimmed = draft.trim();
  const canConfirm = trimmed.length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    setDeliveryPrefs({ address: trimmed });
    onClose();
  };

  return (
    <StoreModal
      open={open}
      onClose={onClose}
      dismissible={!required}
      label={step === 'details' ? 'Détails de la livraison' : 'Choisissez une heure'}
      width="max-w-[520px]"
    >
      <div className="p-6">
        {required ? null : (
          <button type="button" onClick={onClose} className="ue-close mb-6" aria-label="Fermer">
            <X size={20} aria-hidden />
          </button>
        )}

        {step === 'details' ? (
          <>
            <h2 className="ue-h1">Détails de la livraison</h2>

            <div className="mt-6 flex items-center gap-4 border-b border-[var(--ue-border-subtle)] pb-5">
              <MapPin size={24} aria-hidden className="shrink-0" />

              {editingAddress ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        if (canConfirm) setEditingAddress(false);
                      }
                    }}
                    list="communes-kinshasa"
                    placeholder="Votre adresse à Kinshasa"
                    className="ue-field !h-12 min-w-0 flex-1"
                  />
                  <CommunesDatalist />
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 truncate text-base font-medium">
                    {prefs.address}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingAddress(true)}
                    className="ue-btn ue-btn-secondary shrink-0 !py-2.5 !text-sm"
                  >
                    Modifier
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 py-5">
              <Clock size={24} aria-hidden className="shrink-0" />
              <p className="min-w-0 flex-1 truncate text-base font-medium">
                {prefs.slot ?? 'Livrer maintenant'}
              </p>
              <button
                type="button"
                onClick={() => setStep('time')}
                className="ue-btn ue-btn-secondary shrink-0 !py-2.5 !text-sm"
              >
                Planifier
              </button>
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg mt-2"
            >
              Terminé
            </button>

            {required ? (
              <p className="mt-4 text-sm text-[var(--ue-ink-secondary)]">
                Nous livrons partout à Kinshasa. Indiquez votre adresse pour voir la carte et
                les délais.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="ue-h1">Choisissez une heure</h2>

            <div className="mt-6 space-y-3">
              <SelectRow label="Jour de livraison" value="today" onChange={() => {}} disabled>
                <option value="today">Aujourd’hui</option>
              </SelectRow>

              <SelectRow
                label="Créneau"
                value={slotId}
                onChange={(next) => setSlotId(next)}
              >
                <option value="now">Dès que possible</option>
                {SLOT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectRow>
            </div>

            <button
              type="button"
              onClick={() => {
                setDeliveryPrefs({
                  slot:
                    slotId === 'now'
                      ? null
                      : (SLOT_OPTIONS.find((s) => s.id === slotId)?.label ?? null),
                });
                setStep('details');
              }}
              className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg mt-6"
            >
              Planifier
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryPrefs({ slot: null });
                setStep('details');
              }}
              className="ue-btn ue-btn-secondary ue-btn-square ue-btn-lg mt-3"
            >
              Livrer maintenant
            </button>

            {/* Une seule journée proposée : la planification n'existe pas
                encore côté serveur (`fn_place_order` ne prend pas d'heure
                souhaitée). Le dire ici évite de laisser croire à une commande
                pour demain qui n'arriverait jamais en cuisine. */}
            <p className="mt-4 text-sm text-[var(--ue-ink-secondary)]">
              Les commandes pour un autre jour ne sont pas encore acceptées.
            </p>
          </>
        )}
      </div>
    </StoreModal>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="ue-field cursor-pointer appearance-none pr-12 font-medium disabled:cursor-default disabled:opacity-60"
      >
        {children}
      </select>
      <CaretDown size={18} aria-hidden className="pointer-events-none absolute right-4" />
    </label>
  );
}
