'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeSlash, Storefront, WarningCircle } from '@phosphor-icons/react';
import {
  WEEKDAYS,
  formatMoney,
  toUserMessage,
  useOpeningHours,
  useRestaurantDetail,
  useSaveOpeningHours,
  useSaveRestaurant,
  type RestaurantPatch,
} from '@istanbul/core';
import type { OpeningHour, Restaurant } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  SectionTitle,
  Skeleton,
  Toggle,
  inputClass,
} from '@/components/ui';
import { Alert } from '@/components/Alert';
import { MoneyInput } from '@/components/MoneyInput';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useRestaurantAccess } from '@/providers/RestaurantProvider';

/**
 * Paramètres de l'établissement.
 *
 * Deux rythmes d'écriture cohabitent volontairement :
 *
 * — Les **interrupteurs de service** (ouvert, prend les commandes, publié)
 *   s'enregistrent au clic. C'est ce qu'on touche en plein coup de feu quand
 *   la friteuse lâche ; imposer un « Enregistrer » ferait perdre trente
 *   secondes et laisserait entrer des commandes qu'on ne peut pas honorer.
 *
 * — Les **champs de fond** (identité, tarification, horaires) passent par un
 *   brouillon et un bouton d'enregistrement, avec barre de rappel tant que la
 *   modification n'est pas envoyée. Changer une adresse ou un frais de
 *   service à chaque frappe produirait des états intermédiaires absurdes en
 *   base et déclencherait un devis de livraison faux côté client.
 */
export default function SettingsPage() {
  const restaurantId = useRestaurantId();
  const access = useRestaurantAccess();
  const restaurant = useRestaurantDetail(restaurantId);

  if (restaurant.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (restaurant.isError || !restaurant.data) {
    return <ErrorState onRetry={() => void restaurant.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Établissement"
        description="Identité, service et tarification de ce point de vente."
      />

      <ServiceCard restaurant={restaurant.data} />
      <IdentityForm restaurant={restaurant.data} canEdit={access.admin} />
      <EconomicsForm restaurant={restaurant.data} canEdit={access.admin} />
      <OpeningHoursCard restaurantId={restaurantId} canEdit={access.admin} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service — écriture immédiate
// ---------------------------------------------------------------------------

function ServiceCard({ restaurant }: { restaurant: Restaurant }) {
  const save = useSaveRestaurant();
  const toast = useToast();

  const setFlag = (patch: RestaurantPatch, message: string) => {
    save.mutate(
      { restaurantId: restaurant.id, patch },
      {
        onSuccess: () => toast.success(message),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  return (
    <Card>
      <SectionTitle
        title="Service"
        description="Ces trois interrupteurs s’appliquent immédiatement dans l’app client."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <ServiceToggle
          label="Établissement ouvert"
          hint="Affiché « ouvert » dans l’app. Coupez-le en dehors des horaires exceptionnels."
          checked={restaurant.is_open}
          onChange={(value) =>
            setFlag({ is_open: value }, value ? 'Établissement ouvert.' : 'Établissement fermé.')
          }
          pending={save.isPending}
        />

        <ServiceToggle
          label="Accepte les commandes"
          hint="Coupez pendant un coup de feu : la carte reste visible, le panier est bloqué."
          checked={restaurant.is_accepting_orders}
          onChange={(value) =>
            setFlag(
              { is_accepting_orders: value },
              value ? 'Les commandes rentrent à nouveau.' : 'Commandes suspendues.',
            )
          }
          pending={save.isPending}
          tone={restaurant.is_accepting_orders ? 'success' : 'danger'}
        />

        <ServiceToggle
          label="Visible dans l’app"
          hint="Décochez pendant la mise en place de la carte : l’établissement n’apparaît plus dans la liste."
          checked={restaurant.is_published}
          onChange={(value) =>
            setFlag(
              { is_published: value },
              value ? 'Établissement publié.' : 'Établissement retiré de l’app client.',
            )
          }
          pending={save.isPending}
          icon={restaurant.is_published ? Eye : EyeSlash}
        />
      </div>

      {!restaurant.is_published ? (
        <Alert tone="warning" className="mt-4">
          <span className="inline-flex items-center gap-2">
            <WarningCircle size={18} aria-hidden />
            Cet établissement n’apparaît pas dans l’app client. Les clients existants ne peuvent
            pas commander.
          </span>
        </Alert>
      ) : null}
    </Card>
  );
}

function ServiceToggle({
  label,
  hint,
  checked,
  onChange,
  pending,
  tone,
  icon: Icon = Storefront,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  pending: boolean;
  tone?: 'success' | 'danger';
  icon?: typeof Storefront;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: checked ? 'var(--color-border)' : 'var(--color-border-strong)',
        background: checked ? 'var(--color-surface)' : 'var(--color-surface-sunken)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon size={18} aria-hidden className="text-[var(--color-text-muted)]" />
            {label}
          </p>
          {/* L'état est écrit, pas seulement coloré : un daltonien lit
              « Suspendu » là où il ne verrait qu'un gris. */}
          <div className="mt-1.5">
            <Badge tone={checked ? (tone ?? 'success') : 'neutral'} dot>
              {checked ? 'Actif' : 'Suspendu'}
            </Badge>
          </div>
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} disabled={pending} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identité — brouillon + enregistrement
// ---------------------------------------------------------------------------

function IdentityForm({ restaurant, canEdit }: { restaurant: Restaurant; canEdit: boolean }) {
  const { draft, setField, dirty, reset } = useDraft(restaurant, [
    'name',
    'tagline',
    'description',
    'phone',
    'email',
    'address_line',
    'city',
    'latitude',
    'longitude',
    'logo_url',
    'cover_url',
  ]);
  const save = useSaveRestaurant();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const invalid = !draft.name?.trim() || !draft.phone?.trim() || !draft.address_line?.trim();

  const handleSave = () => {
    if (invalid) {
      setError('Nom, téléphone et adresse sont obligatoires.');
      return;
    }
    setError(null);
    save.mutate(
      { restaurantId: restaurant.id, patch: draft },
      {
        onSuccess: () => toast.success('Fiche enregistrée.'),
        onError: (mutationError) => setError(toUserMessage(mutationError)),
      },
    );
  };

  return (
    <Card>
      <SectionTitle
        title="Identité"
        description="Ce que voit le client dans l’app avant de commander."
      />

      {error ? <Alert className="mb-4">{error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom de l’enseigne" required>
          <input
            className={inputClass}
            value={draft.name ?? ''}
            onChange={(event) => setField('name', event.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Accroche" hint="Une ligne, affichée sous le nom.">
          <input
            className={inputClass}
            value={draft.tagline ?? ''}
            onChange={(event) => setField('tagline', event.target.value)}
            placeholder="Grillades turques, tous les jours"
            disabled={!canEdit}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={draft.description ?? ''}
              onChange={(event) => setField('description', event.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <Field label="Téléphone" required hint="Numéro appelé par le client et par le livreur.">
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.phone ?? ''}
            onChange={(event) => setField('phone', event.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="E-mail">
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draft.email ?? ''}
            onChange={(event) => setField('email', event.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Adresse" required>
          <input
            className={inputClass}
            value={draft.address_line ?? ''}
            onChange={(event) => setField('address_line', event.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Commune / ville">
          <input
            className={inputClass}
            value={draft.city ?? ''}
            onChange={(event) => setField('city', event.target.value)}
            disabled={!canEdit}
          />
        </Field>

        <Field
          label="Latitude"
          hint="Sert au calcul de la distance de livraison : une erreur ici fausse tous les frais."
        >
          <input
            className={`${inputClass} tabular`}
            type="number"
            step="0.000001"
            inputMode="decimal"
            value={draft.latitude ?? ''}
            onChange={(event) => setField('latitude', Number(event.target.value))}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Longitude">
          <input
            className={`${inputClass} tabular`}
            type="number"
            step="0.000001"
            inputMode="decimal"
            value={draft.longitude ?? ''}
            onChange={(event) => setField('longitude', Number(event.target.value))}
            disabled={!canEdit}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Logo">
            <ImageUpload
              value={draft.logo_url ?? null}
              onChange={(url) => setField('logo_url', url)}
              folder="restaurants"
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field
            label="Photo d’accueil de la vitrine"
            hint="Le grand visuel derrière « Livraison près de chez vous », sur istanbul.cd. Format paysage, sujet plutôt à droite : le titre se pose sur la moitié gauche."
          >
            <ImageUpload
              value={draft.cover_url ?? null}
              onChange={(url) => setField('cover_url', url)}
              folder="restaurants"
              shape="wide"
            />
          </Field>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        pending={save.isPending}
        canEdit={canEdit}
        onSave={handleSave}
        onReset={reset}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Économie
// ---------------------------------------------------------------------------

function EconomicsForm({ restaurant, canEdit }: { restaurant: Restaurant; canEdit: boolean }) {
  const { draft, setField, dirty, reset } = useDraft(restaurant, [
    'min_order_amount',
    'avg_prep_minutes',
    'service_fee_bps',
    'pickup_enabled',
    'delivery_enabled',
  ]);
  const save = useSaveRestaurant();
  const toast = useToast();

  // Frais de service saisis en pourcentage, stockés en points de base : le
  // gérant pense « 5 % », la base compte en bps pour éviter les flottants.
  const servicePercent =
    draft.service_fee_bps == null ? '' : String(Math.round(draft.service_fee_bps) / 100);

  const handleSave = () => {
    save.mutate(
      { restaurantId: restaurant.id, patch: draft },
      {
        onSuccess: () => toast.success('Paramètres enregistrés.'),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  return (
    <Card>
      <SectionTitle
        title="Commandes et tarification"
        description="Seuil, délai annoncé et frais appliqués au panier."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Panier minimum"
          hint="Le client ne peut pas valider en dessous. 0 = pas de minimum."
        >
          <MoneyInput
            value={draft.min_order_amount ?? 0}
            onChange={(cents) => setField('min_order_amount', cents ?? 0)}
            disabled={!canEdit}
          />
        </Field>

        <Field
          label="Temps de préparation (minutes)"
          hint="Base de l’heure de livraison annoncée. Soyez pessimiste : un retard coûte plus qu’une attente annoncée."
        >
          <input
            className={`${inputClass} tabular`}
            type="number"
            min={1}
            max={240}
            inputMode="numeric"
            value={draft.avg_prep_minutes ?? 25}
            onChange={(event) => setField('avg_prep_minutes', Number(event.target.value))}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Frais de service (%)" hint="Appliqué au sous-total. 0 = désactivé.">
          <input
            className={`${inputClass} tabular`}
            type="number"
            min={0}
            max={50}
            step="0.5"
            inputMode="decimal"
            value={servicePercent}
            onChange={(event) =>
              setField('service_fee_bps', Math.round(Number(event.target.value) * 100))
            }
            disabled={!canEdit}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FulfillmentToggle
          label="Livraison"
          hint="Désactivez si vous n’avez plus de livreur disponible."
          checked={draft.delivery_enabled ?? true}
          onChange={(value) => setField('delivery_enabled', value)}
          disabled={!canEdit}
        />
        <FulfillmentToggle
          label="Retrait sur place"
          hint="Le client vient chercher sa commande au comptoir."
          checked={draft.pickup_enabled ?? true}
          onChange={(value) => setField('pickup_enabled', value)}
          disabled={!canEdit}
        />
      </div>

      {draft.delivery_enabled === false && draft.pickup_enabled === false ? (
        <Alert tone="warning" className="mt-4">
          Livraison et retrait désactivés : plus aucune commande ne peut être passée.
        </Alert>
      ) : null}

      <p className="mt-4 text-xs text-[var(--color-text-muted)]">
        Exemple sur un panier de {formatMoney(1000)} : frais de service{' '}
        <span className="tabular">
          {formatMoney(Math.round((1000 * (draft.service_fee_bps ?? 0)) / 10000))}
        </span>
        .
      </p>

      <SaveBar
        dirty={dirty}
        pending={save.isPending}
        canEdit={canEdit}
        onSave={handleSave}
        onReset={reset}
      />
    </Card>
  );
}

function FulfillmentToggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horaires
// ---------------------------------------------------------------------------

type WeekDraft = Pick<OpeningHour, 'day_of_week' | 'opens_at' | 'closes_at' | 'is_closed'>[];

/** Semaine complète, même si la base ne contient que trois jours. */
function toWeek(hours: OpeningHour[] | undefined): WeekDraft {
  return WEEKDAYS.map((_, day) => {
    const row = hours?.find((hour) => hour.day_of_week === day);
    return {
      day_of_week: day,
      opens_at: (row?.opens_at ?? '10:00:00').slice(0, 5),
      closes_at: (row?.closes_at ?? '22:00:00').slice(0, 5),
      is_closed: row?.is_closed ?? false,
    };
  });
}

function OpeningHoursCard({ restaurantId, canEdit }: { restaurantId: string; canEdit: boolean }) {
  const hours = useOpeningHours(restaurantId);
  const save = useSaveOpeningHours();
  const toast = useToast();

  const initial = useMemo(() => toWeek(hours.data), [hours.data]);
  const [week, setWeek] = useState<WeekDraft>(initial);

  useEffect(() => setWeek(initial), [initial]);

  const dirty = JSON.stringify(week) !== JSON.stringify(initial);
  const invalid = week.some((day) => !day.is_closed && day.closes_at <= day.opens_at);

  const setDay = (index: number, patch: Partial<WeekDraft[number]>) =>
    setWeek((current) => current.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  const handleSave = () => {
    save.mutate(
      {
        restaurantId,
        week: week.map((day) => ({
          ...day,
          opens_at: `${day.opens_at}:00`,
          closes_at: `${day.closes_at}:00`,
        })),
      },
      {
        onSuccess: () => toast.success('Horaires enregistrés.'),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  return (
    <Card>
      <SectionTitle
        title="Horaires d’ouverture"
        description="Affichés dans l’app client. Un jour fermé ne bloque pas les commandes — l’interrupteur « Accepte les commandes » s’en charge."
      />

      {hours.isLoading ? (
        <div className="space-y-2">
          {WEEKDAYS.map((day) => (
            <Skeleton key={day} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {week.map((day, index) => {
            const dayInvalid = !day.is_closed && day.closes_at <= day.opens_at;

            return (
              <div
                key={day.day_of_week}
                className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: dayInvalid ? 'var(--color-danger)' : 'var(--color-border)',
                  background: day.is_closed ? 'var(--color-surface-sunken)' : undefined,
                }}
              >
                <span className="w-24 shrink-0 text-sm font-medium">
                  {WEEKDAYS[day.day_of_week]}
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className={`${inputClass} tabular w-32`}
                    value={day.opens_at}
                    onChange={(event) => setDay(index, { opens_at: event.target.value })}
                    disabled={!canEdit || day.is_closed}
                    aria-label={`Heure d’ouverture — ${WEEKDAYS[day.day_of_week]}`}
                  />
                  <span aria-hidden className="text-[var(--color-text-muted)]">
                    →
                  </span>
                  <input
                    type="time"
                    className={`${inputClass} tabular w-32`}
                    value={day.closes_at}
                    onChange={(event) => setDay(index, { closes_at: event.target.value })}
                    disabled={!canEdit || day.is_closed}
                    aria-label={`Heure de fermeture — ${WEEKDAYS[day.day_of_week]}`}
                  />
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">Fermé</span>
                  <Toggle
                    checked={day.is_closed}
                    onChange={(value) => setDay(index, { is_closed: value })}
                    label={`Fermé le ${WEEKDAYS[day.day_of_week]}`}
                    disabled={!canEdit}
                  />
                </div>

                {dayInvalid ? (
                  <p role="alert" className="w-full text-xs text-[var(--color-danger)]">
                    L’heure de fermeture doit être postérieure à l’ouverture.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <SaveBar
        dirty={dirty && !invalid}
        pending={save.isPending}
        canEdit={canEdit}
        onSave={handleSave}
        onReset={() => setWeek(initial)}
        blocked={dirty && invalid ? 'Corrigez les horaires en rouge avant d’enregistrer.' : null}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Outils de formulaire
// ---------------------------------------------------------------------------

/**
 * Brouillon local d'un sous-ensemble de champs.
 *
 * Resynchronisé quand la ligne serveur change (un collègue enregistre depuis
 * un autre poste), mais jamais pendant qu'on tape : la comparaison se fait sur
 * la valeur d'origine, pas sur le brouillon.
 */
function useDraft<K extends keyof RestaurantPatch>(restaurant: Restaurant, fields: K[]) {
  const initial = useMemo(() => {
    const seed = {} as Pick<RestaurantPatch, K>;
    for (const field of fields) {
      seed[field] = restaurant[field as keyof Restaurant] as RestaurantPatch[K];
    }
    return seed;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fields` est un littéral stable
  }, [restaurant]);

  const [draft, setDraft] = useState<Pick<RestaurantPatch, K>>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const setField = <F extends K>(field: F, value: RestaurantPatch[F]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return {
    draft,
    setField,
    dirty: JSON.stringify(draft) !== JSON.stringify(initial),
    reset: () => setDraft(initial),
  };
}

/**
 * Barre de rappel de modification non enregistrée.
 *
 * Elle n'apparaît que si quelque chose a changé : un bouton « Enregistrer »
 * toujours visible et toujours cliquable n'apprend rien sur l'état du
 * formulaire, et invite à sauvegarder des formulaires intacts.
 */
function SaveBar({
  dirty,
  pending,
  canEdit,
  onSave,
  onReset,
  blocked,
}: {
  dirty: boolean;
  pending: boolean;
  canEdit: boolean;
  onSave: () => void;
  onReset: () => void;
  blocked?: string | null;
}) {
  if (!canEdit) {
    return (
      <p className="mt-5 text-xs text-[var(--color-text-muted)]">
        Lecture seule : seul le propriétaire de l’établissement modifie ces réglages.
      </p>
    );
  }

  if (blocked) {
    return (
      <Alert tone="warning" className="mt-5">
        {blocked}
      </Alert>
    );
  }

  if (!dirty) return null;

  return (
    <div
      className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t pt-4"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <p className="mr-auto text-sm text-[var(--color-text-secondary)]" aria-live="polite">
        Modifications non enregistrées.
      </p>
      <Button variant="ghost" onClick={onReset} disabled={pending}>
        Annuler
      </Button>
      <Button onClick={onSave} loading={pending}>
        Enregistrer
      </Button>
    </div>
  );
}
