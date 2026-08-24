'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CaretDown, Clock, MapPin } from '@phosphor-icons/react';
import { KINSHASA_COMMUNES } from '@/lib/coverage';
import { setDeliveryPrefs, useDeliveryPrefs } from '@/lib/delivery-prefs';
import { SLOT_OPTIONS } from '@/components/store/slots';

/**
 * Le bloc de recherche du héros : champ d'adresse, créneau, bouton.
 *
 * Uber le compose de trois blocs séparés et non d'un seul champ segmenté —
 * c'est ce qui lui donne son épaisseur (56 px) et permet au bouton d'être
 * noir plein sans écraser le reste. On reprend la même découpe, avec un
 * empilement vertical sous 1024 px.
 *
 * Pas de géocodage : l'adresse saisie est retenue telle quelle et sert à
 * décider si l'on livre (voir `lib/coverage`). La position exacte est
 * confirmée plus tard par `fn_delivery_quote`. Une liste des communes est
 * proposée en `datalist` — sans autocomplétion géographique, c'est ce qui
 * évite au client de se demander ce qu'on attend de lui.
 */
export function AddressSearch() {
  const router = useRouter();
  const prefs = useDeliveryPrefs();

  // Champ non contrôlé par le magasin : on ne veut pas réécrire l'adresse
  // mémorisée à chaque frappe, seulement à la validation.
  const [address, setAddress] = useState<string | null>(null);
  const [slot, setSlot] = useState('now');

  const value = address ?? prefs.address ?? '';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = value.trim();
    setDeliveryPrefs({
      address: trimmed || null,
      slot: slot === 'now' ? null : (SLOT_OPTIONS.find((s) => s.id === slot)?.label ?? null),
    });

    // On navigue même hors zone : c'est le feed qui annonce « bientôt chez
    // vous », exactement comme Uber Eats, et le message y est partageable
    // par URL.
    router.push('/feed');
  };

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
            value={value}
            onChange={(event) => setAddress(event.target.value)}
            list="communes-kinshasa"
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
            {SLOT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
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

      <CommunesDatalist />

      <p className="mt-4 text-base">
        Ou{' '}
        <Link href="/connexion" className="font-medium underline underline-offset-2">
          connectez-vous
        </Link>
      </p>
    </div>
  );
}

/** Suggestions de communes, partagées par tous les champs d'adresse. */
export function CommunesDatalist() {
  return (
    <datalist id="communes-kinshasa">
      {KINSHASA_COMMUNES.map((commune) => (
        <option key={commune} value={`${commune}, Kinshasa`} />
      ))}
    </datalist>
  );
}
