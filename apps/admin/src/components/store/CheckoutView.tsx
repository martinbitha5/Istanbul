'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle } from '@phosphor-icons/react';
import {
  computeTotals,
  formatMoney,
  lineTotal,
  placeOrder,
  saveAddress,
  selectSubtotal,
  summarizeOptions,
  toPlaceOrderItems,
  toUserMessage,
  useCartStore,
  useDeliveryQuote,
  useProfile,
  useSession,
} from '@istanbul/core';
import type { DeliveryZone, Order, Restaurant } from '@istanbul/types';
import { isInCoverage, isPointInCoverage } from '@/lib/coverage';
import { COMMUNE_NAMES } from '@/lib/kinshasa';
import { setDeliveryPrefs, useDeliveryPrefs } from '@/lib/delivery-prefs';
import { StoreHeader } from '@/components/store/StoreHeader';

/**
 * Confirmation de commande.
 *
 * Ce qui est réellement envoyé au serveur tient en un appel — `fn_place_order`
 * recalcule lignes, options, frais et remise dans une seule transaction. Les
 * totaux affichés ici passent par `computeTotals`, qui est la réplique exacte
 * de ce calcul SQL : le client ne découvre pas un montant différent après
 * validation.
 *
 * L'adresse est enregistrée dans `addresses` juste avant, sans coordonnées.
 * `fn_delivery_quote` sait faire : sans latitude ni longitude il applique la
 * zone active la moins chère et répond `in_range`. Le tarif exact suivra le
 * jour où un géocodage donnera une position — d'ici là, mieux vaut un tarif
 * plancher annoncé qu'un refus « hors zone » sur une adresse parfaitement
 * livrable.
 */
export function CheckoutView({
  restaurant,
  zones,
}: {
  restaurant: Restaurant;
  zones: DeliveryZone[];
}) {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { profile } = useProfile();
  const prefs = useDeliveryPrefs();

  const lines = useCartStore((state) => state.lines);
  const subtotal = useCartStore(selectSubtotal);
  const clearCart = useCartStore((state) => state.clear);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [commune, setCommune] = useState('');
  const [notes, setNotes] = useState('');
  const [pickup, setPickup] = useState(prefs.mode === 'pickup');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);

  // Sans session, la page n'a rien à afficher : on renvoie sur la connexion
  // en gardant la destination, comme le fait le bouton « Commander ».
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace(`/connexion?next=${encodeURIComponent('/commande')}`);
    }
  }, [session, sessionLoading, router]);

  // Pré-remplissage : le profil pour l'identité, l'adresse mémorisée pour la
  // livraison. Le client ne doit pas ressaisir ce qu'il a déjà donné.
  useEffect(() => {
    if (profile) {
      setName((current) => current || profile.full_name);
      setPhone((current) => current || (profile.phone ?? ''));
    }
  }, [profile]);

  useEffect(() => {
    if (prefs.address) setStreet((current) => current || prefs.address!);
  }, [prefs.address]);

  const fullAddress = `${street.trim()}${commune ? `, ${commune}` : ''}`;

  /**
   * Le repère posé sur la carte du feed — mais seulement s'il désigne encore
   * cette adresse-là. Dès que le client retouche la rue ici, les coordonnées
   * mémorisées cessent de lui correspondre : les garder ferait partir le
   * livreur à l'adresse précédente, et c'est le genre d'erreur qu'on ne
   * découvre qu'au moment où le repas arrive chez quelqu'un d'autre.
   */
  const point =
    prefs.lat !== null && prefs.lng !== null && street.trim() === (prefs.address ?? '').trim()
      ? { lat: prefs.lat, lng: prefs.lng }
      : null;

  const addressCovered = pickup
    ? true
    : point
      ? isPointInCoverage(point.lat, point.lng)
      : isInCoverage(fullAddress);

  // Avec coordonnées, `fn_delivery_quote` facture la vraie distance ; sans,
  // elle retombe sur la zone la moins chère. `enabled` seulement en livraison
  // — un retrait n'a pas de frais.
  const { data: quote } = useDeliveryQuote(
    restaurant.id,
    point?.lat ?? null,
    point?.lng ?? null,
    subtotal,
    !pickup && lines.length > 0,
  );

  const totals = useMemo(
    () =>
      computeTotals({
        lines,
        deliveryQuote: pickup ? null : (quote ?? null),
        serviceFeeBps: restaurant.service_fee_bps,
      }),
    [lines, quote, pickup, restaurant.service_fee_bps],
  );

  const canSubmit =
    lines.length > 0 &&
    name.trim().length > 1 &&
    phone.trim().length > 5 &&
    (pickup || (street.trim().length > 2 && addressCovered)) &&
    !submitting;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      let addressId: string | null = null;

      if (!pickup) {
        const address = await saveAddress({
          label: 'Livraison',
          recipient_name: name.trim(),
          phone: phone.trim(),
          commune: commune || null,
          street: street.trim(),
          details: null,
          delivery_notes: notes.trim() || null,
          latitude: point?.lat ?? null,
          longitude: point?.lng ?? null,
          is_default: true,
        });
        addressId = address.id;
        setDeliveryPrefs({
          address: fullAddress,
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
        });
      }

      const order = await placeOrder({
        restaurantId: restaurant.id,
        fulfillment: pickup ? 'PICKUP' : 'DELIVERY',
        items: toPlaceOrderItems(lines),
        contactName: name.trim(),
        contactPhone: phone.trim(),
        addressId,
        deliveryNotes: notes.trim() || null,
        customerNote: prefs.slot ? `Souhaité : ${prefs.slot}` : null,
        paymentProvider: 'CASH',
      });

      clearCart();
      setPlaced(order);
    } catch (caught) {
      setError(toUserMessage(caught));
      setSubmitting(false);
    }
  };

  if (placed) {
    return (
      <>
        <StoreHeader variant="landing" />
        <main className="ue-container flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center">
          <CheckCircle size={64} weight="fill" style={{ color: 'var(--ue-green-text)' }} aria-hidden />
          <h1 className="ue-h1 mt-6">Commande envoyée</h1>
          <p className="mt-3 max-w-[46ch] text-base text-[var(--ue-ink-secondary)]">
            La cuisine a reçu votre commande n° {placed.order_number}. Vous serez appelé au{' '}
            {phone.trim()} si nous avons besoin d’une précision. Paiement à la livraison.
          </p>
          <Link href="/feed" className="ue-btn ue-btn-primary mt-8">
            Retour à la carte
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <StoreHeader variant="landing" />

      <main className="ue-container py-10">
        <h1 className="ue-h1">Votre commande</h1>

        {lines.length === 0 ? (
          <div className="mt-8">
            <p className="text-base text-[var(--ue-ink-secondary)]">Votre panier est vide.</p>
            <Link href="/feed" className="ue-btn ue-btn-primary mt-6">
              Voir la carte
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div className="min-w-0">
              <fieldset>
                <legend className="ue-h3">Mode de retrait</legend>
                <div className="mt-3 flex gap-2">
                  <ModeButton active={!pickup} onClick={() => setPickup(false)}>
                    Livraison
                  </ModeButton>
                  {restaurant.pickup_enabled ? (
                    <ModeButton active={pickup} onClick={() => setPickup(true)}>
                      À emporter
                    </ModeButton>
                  ) : null}
                </div>
              </fieldset>

              <fieldset className="mt-8">
                <legend className="ue-h3">Vos coordonnées</legend>
                <div className="mt-3 space-y-3">
                  <Labelled label="Nom complet">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      className="ue-field"
                      required
                    />
                  </Labelled>
                  <Labelled label="Téléphone">
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="0999 000 105"
                      className="ue-field"
                      required
                    />
                  </Labelled>
                </div>
              </fieldset>

              {pickup ? (
                <p className="mt-8 rounded-[var(--ue-radius)] bg-[var(--ue-surface-sunken)] px-4 py-3 text-base">
                  À récupérer au {restaurant.address_line}, {restaurant.city}.
                </p>
              ) : (
                <fieldset className="mt-8">
                  <legend className="ue-h3">Adresse de livraison</legend>
                  <div className="mt-3 space-y-3">
                    <Labelled label="Rue et numéro">
                      <input
                        value={street}
                        onChange={(event) => setStreet(event.target.value)}
                        autoComplete="street-address"
                        className="ue-field"
                        required
                      />
                    </Labelled>
                    <Labelled label="Commune">
                      <select
                        value={commune}
                        onChange={(event) => setCommune(event.target.value)}
                        className="ue-field cursor-pointer"
                      >
                        <option value="">Choisir une commune</option>
                        {COMMUNE_NAMES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Labelled>
                    <Labelled label="Indications pour le livreur (facultatif)">
                      <input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Portail vert, en face de la pharmacie"
                        className="ue-field"
                      />
                    </Labelled>
                  </div>

                  {!addressCovered && street.trim().length > 2 ? (
                    <p className="mt-3 text-sm font-medium" style={{ color: 'var(--ue-promo)' }}>
                      Nous ne livrons qu’à Kinshasa pour l’instant. Précisez votre commune.
                    </p>
                  ) : null}
                </fieldset>
              )}

              <p className="mt-8 rounded-[var(--ue-radius)] bg-[var(--ue-surface-sunken)] px-4 py-3 text-base">
                Paiement en espèces à la livraison. Le paiement mobile arrive prochainement.
              </p>
            </div>

            <aside className="min-w-0">
              <div className="rounded-[var(--ue-radius)] border border-[var(--ue-border)] p-5">
                <p className="ue-h3">Récapitulatif</p>

                <ul className="mt-4 space-y-3">
                  {lines.map((line) => (
                    <li key={line.key} className="flex gap-3 text-base">
                      <span className="shrink-0 font-medium tabular-nums">{line.quantity}×</span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{line.product_name}</span>
                        {line.options.length > 0 ? (
                          <span className="block text-sm text-[var(--ue-ink-secondary)]">
                            {summarizeOptions(line.options)}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(lineTotal(line), restaurant.currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 space-y-2 border-t border-[var(--ue-border-subtle)] pt-4 text-base">
                  <Row label="Sous-total" value={formatMoney(totals.subtotal, restaurant.currency)} />
                  {!pickup ? (
                    <Row
                      label={`Livraison${quote?.zone_name ? ` — ${quote.zone_name}` : ''}`}
                      value={formatMoney(totals.deliveryFee, restaurant.currency)}
                    />
                  ) : null}
                  {totals.serviceFee > 0 ? (
                    <Row
                      label="Frais de service"
                      value={formatMoney(totals.serviceFee, restaurant.currency)}
                    />
                  ) : null}
                  <div className="flex justify-between border-t border-[var(--ue-border-subtle)] pt-3 text-lg font-bold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">
                      {formatMoney(totals.total, restaurant.currency)}
                    </dd>
                  </div>
                </dl>

                {error ? (
                  <p role="alert" className="mt-4 text-sm font-medium" style={{ color: 'var(--ue-promo)' }}>
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="ue-btn ue-btn-primary ue-btn-square ue-btn-lg mt-5"
                >
                  {submitting ? 'Envoi…' : 'Confirmer la commande'}
                </button>

                {zones.length > 0 && !pickup ? (
                  <p className="mt-3 text-sm text-[var(--ue-ink-secondary)]">
                    Délai estimé : {quote?.eta_minutes ?? restaurant.avg_prep_minutes} min.
                  </p>
                ) : null}
              </div>
            </aside>
          </form>
        )}
      </main>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="ue-chip">
      {children}
    </button>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--ue-ink-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--ue-ink-secondary)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
