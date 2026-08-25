'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CaretDown, Clock, Crosshair, MapPin } from '@phosphor-icons/react';
import { COMMUNE_NAMES } from '@/lib/kinshasa';
import { searchAddress, type GeoResult } from '@/lib/geocode';
import { setDeliveryPrefs, useDeliveryPrefs } from '@/lib/delivery-prefs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SLOT_OPTIONS } from '@/components/store/slots';

/**
 * Le bloc de recherche du héros : champ d'adresse, créneau, bouton.
 *
 * Uber le compose de trois blocs séparés et non d'un seul champ segmenté —
 * c'est ce qui lui donne son épaisseur (56 px) et permet au bouton d'être
 * noir plein sans écraser le reste. On reprend la même découpe, avec un
 * empilement vertical sous 1024 px.
 *
 * Le champ propose de vraies adresses, bornées à Kinshasa (Nominatim /
 * OpenStreetMap). Choisir une suggestion retient aussi ses coordonnées : la
 * commande part alors avec une position exacte, et la carte du feed s'ouvre
 * déjà centrée au bon endroit. Une adresse tapée puis validée sans passer par
 * la liste reste acceptée — elle voyage en texte, et le repère se pose plus
 * tard sur la carte.
 */
export function AddressSearch() {
  const router = useRouter();
  const prefs = useDeliveryPrefs();

  // Champ non contrôlé par le magasin : on ne veut pas réécrire l'adresse
  // mémorisée à chaque frappe, seulement à la validation.
  const [address, setAddress] = useState<string | null>(null);
  const [picked, setPicked] = useState<GeoResult | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState('now');

  const boxRef = useRef<HTMLDivElement>(null);
  const value = address ?? prefs.address ?? '';
  const debounced = useDebouncedValue(value, 450);

  useEffect(() => {
    // `address === null` : le client n'a pas encore touché au champ, la valeur
    // affichée vient du stockage. Rien à suggérer sur une adresse déjà choisie.
    if (address === null || debounced.trim().length < 3) {
      setResults([]);
      return;
    }
    if (picked && picked.label === debounced) return;

    const controller = new AbortController();
    void searchAddress(debounced, controller.signal).then((found) => {
      setResults(found);
      setOpen(found.length > 0);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, address === null]);

  // Clic hors du bloc : la liste se referme. Sans cela elle reste ouverte
  // par-dessus les cartes de parcours en dessous du héros.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const go = (result: GeoResult | null, label: string) => {
    setDeliveryPrefs({
      address: label.trim() || null,
      // Coordonnées uniquement si elles correspondent à ce texte-là. Les
      // garder après une saisie libre livrerait la commande à l'adresse
      // précédente sans que personne ne s'en aperçoive.
      lat: result?.lat ?? null,
      lng: result?.lng ?? null,
      slot: slot === 'now' ? null : (SLOT_OPTIONS.find((s) => s.id === slot)?.label ?? null),
    });

    // On navigue même hors zone : c'est le feed qui annonce « bientôt chez
    // vous », exactement comme Uber Eats, et le message y est partageable
    // par URL.
    router.push('/feed');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Le repère mémorisé n'est réutilisé que si le texte n'a pas bougé.
    const unchanged = address === null || address.trim() === (prefs.address ?? '').trim();
    const stored =
      unchanged && prefs.lat !== null && prefs.lng !== null
        ? { lat: prefs.lat, lng: prefs.lng, label: value, full: value }
        : null;
    go(picked ?? stored, value);
  };

  return (
    <div className="w-full max-w-[940px]">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3"
      >
        <div ref={boxRef} className="relative min-w-0 flex-1">
          <label className="relative flex min-w-0 items-center rounded-[var(--ue-radius)] bg-[var(--ue-surface)]">
            <MapPin
              size={22}
              weight="fill"
              aria-hidden
              className="pointer-events-none absolute left-4 text-[var(--ue-ink)]"
            />
            <span className="sr-only">Adresse de livraison</span>
            <input
              value={value}
              onChange={(event) => {
                setAddress(event.target.value);
                setPicked(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(results.length > 0)}
              list="communes-kinshasa"
              placeholder="Saisissez votre adresse de livraison"
              autoComplete="street-address"
              className="h-14 w-full rounded-[var(--ue-radius)] bg-transparent pl-12 pr-4 text-base outline-none placeholder:text-[var(--ue-ink-secondary)]"
            />
          </label>

          {open && results.length > 0 ? (
            <ul
              className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-[var(--ue-radius)] text-left"
              style={{ background: 'var(--ue-surface)', boxShadow: 'var(--ue-shadow-pop)' }}
            >
              {results.map((result) => (
                <li key={`${result.lat},${result.lng},${result.label}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setAddress(result.label);
                      setPicked(result);
                      setOpen(false);
                      go(result, result.label);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-base hover:bg-[var(--ue-surface-sunken)]"
                  >
                    <Crosshair size={16} aria-hidden className="shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

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
      {COMMUNE_NAMES.map((commune) => (
        <option key={commune} value={`${commune}, Kinshasa`} />
      ))}
    </datalist>
  );
}
