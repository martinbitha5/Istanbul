'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CaretDown, Clock, MapPin } from '@phosphor-icons/react';

/** Clé de persistance de l'adresse — relue par le feed au premier rendu. */
export const ADDRESS_STORAGE_KEY = 'istanbul.store.address';

/**
 * Le bloc de recherche du héros : champ d'adresse, créneau, bouton.
 *
 * Uber le compose de trois blocs séparés par un filet et non d'un seul champ
 * segmenté — c'est ce qui lui donne son épaisseur (56 px) et permet au bouton
 * d'être noir plein sans écraser le reste. On reprend la même découpe, avec
 * un empilement vertical sous 640 px là où Uber conserve la ligne.
 *
 * Pas de géocodage ici : l'adresse saisie sert à afficher le contexte et sera
 * confirmée au moment du devis de livraison (`fn_delivery_quote`), qui
 * travaille sur des coordonnées. Promettre une autocomplétion qu'on ne sait
 * pas encore honorer coûterait plus cher qu'un champ libre honnête.
 */
export function AddressSearch({
  defaultValue = '',
  onDark = false,
}: {
  defaultValue?: string;
  /** Posé sur le héros photographique : le lien « Se connecter » passe en blanc. */
  onDark?: boolean;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(defaultValue);
  const [slot, setSlot] = useState('now');

  // L'adresse déjà choisie lors d'une visite précédente repeuple le champ.
  useEffect(() => {
    if (defaultValue) return;
    try {
      const stored = window.localStorage.getItem(ADDRESS_STORAGE_KEY);
      if (stored) setAddress(stored);
    } catch {
      // Navigation privée, stockage refusé : le champ reste vide, sans plus.
    }
  }, [defaultValue]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = address.trim();
    try {
      if (trimmed) window.localStorage.setItem(ADDRESS_STORAGE_KEY, trimmed);
    } catch {
      // Idem : l'absence de stockage ne doit pas empêcher la navigation.
    }

    const params = new URLSearchParams();
    if (trimmed) params.set('adresse', trimmed);
    if (slot !== 'now') params.set('creneau', slot);

    const query = params.toString();
    router.push(`/feed${query ? `?${query}` : ''}`);
  };

  // 940 px, comme le bloc d'origine : un champ d'adresse d'environ 565 px, le
  // créneau et le bouton à sa droite. Réduit à 620, le champ tombait sous
  // 250 px et tronquait son propre libellé. La ligne ne se forme qu'à partir
  // de 1024 px ; en dessous les trois blocs s'empilent.
  return (
    <div className="w-full max-w-[940px]">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3"
      >
        <label className="relative flex min-w-0 flex-1 items-center rounded-[var(--ue-radius)] bg-[var(--ue-surface)]">
          <MapPin
            size={22}
            weight="fill"
            aria-hidden
            className="pointer-events-none absolute left-4 text-[var(--ue-ink)]"
          />
          <span className="sr-only">Adresse de livraison</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Saisissez votre adresse de livraison"
            autoComplete="street-address"
            className="h-14 w-full rounded-[var(--ue-radius)] bg-transparent pl-12 pr-4 text-base outline-none placeholder:text-[var(--ue-ink-secondary)]"
          />
        </label>

        <label className="relative flex shrink-0 items-center rounded-[var(--ue-radius)] bg-[var(--ue-surface)]">
          <Clock
            size={20}
            aria-hidden
            className="pointer-events-none absolute left-4 text-[var(--ue-ink)]"
          />
          <span className="sr-only">Créneau de livraison</span>
          <select
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            className="h-14 cursor-pointer appearance-none rounded-[var(--ue-radius)] bg-transparent pl-11 pr-10 text-base font-medium outline-none"
          >
            <option value="now">Livrer maintenant</option>
            <option value="30">Dans 30 minutes</option>
            <option value="60">Dans 1 heure</option>
            <option value="evening">Ce soir</option>
          </select>
          <CaretDown
            size={16}
            aria-hidden
            className="pointer-events-none absolute right-4 text-[var(--ue-ink)]"
          />
        </label>

        <button type="submit" className="ue-btn ue-btn-primary h-14 shrink-0 !px-8">
          Rechercher
        </button>
      </form>

      <p
        className="mt-4 text-base"
        style={{ color: onDark ? 'var(--ue-ink-inverse)' : 'var(--ue-ink)' }}
      >
        Ou{' '}
        <Link href="/admin/login" className="font-medium underline underline-offset-2">
          connectez-vous
        </Link>
      </p>
    </div>
  );
}
