'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretDown, Clock, Crosshair, MapPin, MapTrifold, X } from '@phosphor-icons/react';
import type { DeliveryZone, Restaurant } from '@istanbul/types';
import { formatMoney } from '@istanbul/core';
import { SLOT_OPTIONS } from '@/components/store/slots';
import { StoreModal } from '@/components/store/StoreModal';
import { KinshasaMap } from '@/components/store/KinshasaMap';
import { CommunesDatalist } from '@/components/store/AddressSearch';
import { deliveryRings, zoneForDistance } from '@/lib/zones';
import { setDeliveryPrefs, useDeliveryPrefs } from '@/lib/delivery-prefs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  KINSHASA_CENTER,
  distanceKm,
  reverseGeocode,
  searchAddress,
  type GeoPoint,
  type GeoResult,
} from '@/lib/geocode';

/**
 * « Détails de la livraison » — devenu un sélecteur d'adresse sur carte.
 *
 * Ce que remplaçait l'écran précédent : un champ de texte, et la même phrase
 * réaffichée à l'écran suivant. Le client tapait « Ngaliema », on lui
 * répondait « Ngaliema », et rien ne lui disait où il se trouvait, ni s'il
 * était loin, ni ce que ça coûterait. C'est ce qu'on corrige ici — la carte
 * répond aux trois questions d'un coup d'œil.
 *
 * Trois façons de désigner l'endroit, dans l'ordre où on s'en sert :
 *
 *   1. le bouton « Ma position », quand on commande depuis chez soi ;
 *   2. la saisie, avec des suggestions réelles bornées à Kinshasa
 *      (Nominatim / OpenStreetMap) ;
 *   3. le doigt, en posant ou glissant le repère — la seule qui marche quand
 *      l'adresse n'a pas de nom de rue, ce qui est le cas courant ici.
 *
 * Les trois convergent vers la même chose : un libellé **et** des coordonnées.
 * Le libellé sert au livreur, les coordonnées à `fn_delivery_quote`. Le
 * libellé seul reste accepté — le géocodage peut être en panne, la
 * géolocalisation refusée, et une commande ne doit jamais buter là-dessus.
 *
 * `required` est le cas d'entrée : arrivé sur la carte sans adresse, la modale
 * s'ouvre d'elle-même et ne se ferme pas tant qu'on n'a rien saisi.
 */
export function DeliveryDetailsModal({
  open,
  onClose,
  required = false,
  restaurant,
  zones = [],
}: {
  open: boolean;
  onClose: () => void;
  required?: boolean;
  restaurant: Restaurant;
  zones?: DeliveryZone[];
}) {
  const prefs = useDeliveryPrefs();

  const [step, setStep] = useState<'details' | 'time'>('details');
  const [draft, setDraft] = useState('');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [slotId, setSlotId] = useState<string>('now');

  // À chaque ouverture on repart de l'état réel : sinon la modale rouvre sur
  // le brouillon abandonné la fois précédente.
  useEffect(() => {
    if (!open) return;
    setStep('details');
    setDraft(prefs.address ?? '');
    setPoint(prefs.lat !== null && prefs.lng !== null ? { lat: prefs.lat, lng: prefs.lng } : null);
    setSlotId(prefs.slot ? (SLOT_OPTIONS.find((s) => s.label === prefs.slot)?.id ?? 'now') : 'now');
  }, [open, prefs.address, prefs.lat, prefs.lng, prefs.slot]);

  const trimmed = draft.trim();
  const canConfirm = trimmed.length > 0;

  const origin: GeoPoint = {
    lat: restaurant.latitude ?? KINSHASA_CENTER.lat,
    lng: restaurant.longitude ?? KINSHASA_CENTER.lng,
  };

  const rings = deliveryRings(zones, restaurant.currency);
  const distance = point ? distanceKm(origin, point) : null;
  const matchedZone = distance === null ? null : zoneForDistance(zones, distance);

  const confirm = () => {
    if (!canConfirm) return;
    setDeliveryPrefs({
      address: trimmed,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    });
    onClose();
  };

  return (
    <StoreModal
      open={open}
      onClose={onClose}
      dismissible={!required}
      label={step === 'details' ? 'Détails de la livraison' : 'Choisissez une heure'}
      width="max-w-[560px]"
    >
      <div className="overflow-y-auto p-6">
        {required ? null : (
          <button type="button" onClick={onClose} className="ue-close mb-5" aria-label="Fermer">
            <X size={20} aria-hidden />
          </button>
        )}

        {step === 'details' ? (
          <>
            <h2 className="ue-h1">Où livrons-nous ?</h2>
            <p className="mt-2 text-base text-[var(--ue-ink-secondary)]">
              Posez le repère à votre porte. Nous livrons partout à Kinshasa.
            </p>

            <div className="mt-5">
              <KinshasaMap
                restaurant={{ ...origin, name: restaurant.name }}
                pin={point}
                onPinChange={setPoint}
                rings={rings}
                height={260}
                basemap="positron"
              />
            </div>

            <AddressField
              value={draft}
              onChange={setDraft}
              point={point}
              onPick={(result) => {
                setDraft(result.label);
                setPoint({ lat: result.lat, lng: result.lng });
              }}
              onPointLabel={setDraft}
            />

            {distance !== null ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
                <MapTrifold size={16} aria-hidden />
                <span className="font-medium">
                  {distance.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
                </span>
                <span className="text-[var(--ue-ink-secondary)]">du restaurant</span>
                {matchedZone ? (
                  <span style={{ color: 'var(--ue-green-text)' }}>
                    ·{' '}
                    {matchedZone.fee_amount === 0
                      ? 'livraison offerte'
                      : formatMoney(matchedZone.fee_amount, restaurant.currency)}{' '}
                    · {matchedZone.eta_minutes} min
                  </span>
                ) : null}
              </p>
            ) : null}

            <div className="mt-4 flex items-center gap-4 border-t border-[var(--ue-border-subtle)] py-5">
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
              className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg"
            >
              Terminé
            </button>
          </>
        ) : (
          <>
            <h2 className="ue-h1">Choisissez une heure</h2>

            <div className="mt-6 space-y-3">
              <SelectRow label="Jour de livraison" value="today" onChange={() => {}} disabled>
                <option value="today">Aujourd’hui</option>
              </SelectRow>

              <SelectRow label="Créneau" value={slotId} onChange={setSlotId}>
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

/**
 * Le champ d'adresse et ses suggestions.
 *
 * Deux sources se croisent ici et il ne faut pas qu'elles se battent :
 * la frappe du client, qui interroge Nominatim, et le repère posé sur la
 * carte, qui fait le chemin inverse (géocodage inversé). Le drapeau
 * `fromMap` distingue les deux — sans lui, l'adresse retournée par la carte
 * relancerait aussitôt une recherche sur elle-même, et la liste de
 * suggestions s'ouvrirait toute seule après chaque déplacement du repère.
 */
function AddressField({
  value,
  onChange,
  point,
  onPick,
  onPointLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  point: GeoPoint | null;
  onPick: (result: GeoResult) => void;
  onPointLabel: (label: string) => void;
}) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const fromMap = useRef(false);

  const debounced = useDebouncedValue(value, 450);

  // Frappe → suggestions.
  useEffect(() => {
    if (fromMap.current) {
      fromMap.current = false;
      return;
    }
    if (debounced.trim().length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    void searchAddress(debounced, controller.signal).then((found) => {
      setResults(found);
      setOpen(found.length > 0);
    });
    return () => controller.abort();
  }, [debounced]);

  // Repère → libellé.
  useEffect(() => {
    if (!point) return;

    const controller = new AbortController();
    void reverseGeocode(point, controller.signal).then((label) => {
      if (!label) return;
      fromMap.current = true;
      setResults([]);
      setOpen(false);
      onPointLabel(label);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lng]);

  return (
    <div className="relative mt-5">
      <label className="flex items-center gap-3">
        <MapPin size={24} aria-hidden className="shrink-0" />
        <span className="sr-only">Adresse de livraison</span>
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(results.length > 0)}
          // Le repli sans réseau : la liste des communes reste proposée par le
          // navigateur même si Nominatim ne répond pas.
          list="communes-kinshasa"
          placeholder="Avenue, quartier, commune…"
          autoComplete="street-address"
          className="ue-field !h-12 min-w-0 flex-1"
        />
      </label>
      <CommunesDatalist />

      {open && results.length > 0 ? (
        <ul
          className="absolute left-9 right-0 z-10 mt-1 overflow-hidden rounded-[var(--ue-radius)]"
          style={{ background: 'var(--ue-surface)', boxShadow: 'var(--ue-shadow-pop)' }}
        >
          {results.map((result) => (
            <li key={`${result.lat},${result.lng},${result.label}`}>
              <button
                type="button"
                onClick={() => {
                  fromMap.current = true;
                  setOpen(false);
                  setResults([]);
                  onPick(result);
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-base hover:bg-[var(--ue-surface-sunken)]"
              >
                <Crosshair size={16} aria-hidden className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
