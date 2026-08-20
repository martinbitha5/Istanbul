'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Buildings, Plus } from '@phosphor-icons/react';
import {
  formatMoney,
  revenueRange,
  toUserMessage,
  useAllRestaurants,
  useCreateRestaurant,
  usePlatformRevenue,
  type PlatformRevenueRow,
  type RevenuePeriod,
} from '@istanbul/core';
import type { Restaurant } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  SectionTitle,
  Skeleton,
  Table,
  TableSkeleton,
  Td,
  Th,
  inputClass,
} from '@/components/ui';
import { Alert } from '@/components/Alert';
import { FilterChips } from '@/components/FilterChips';
import { useToast } from '@/components/Toaster';
import { useRestaurantContext } from '@/providers/RestaurantProvider';

/**
 * Partenaires de la plateforme.
 *
 * Le seul écran qui traverse les cloisons du multi-restaurants — et pour cette
 * raison le seul réservé aux ADMIN de la plateforme. Un partenaire n'y accède
 * pas : la RLS lui renverrait de toute façon sa propre ligne, mais l'entrée de
 * navigation reste masquée pour ne pas suggérer qu'il existe un annuaire à
 * explorer.
 *
 * La page répond à deux questions distinctes, d'où sa structure : « qui est sur
 * la plateforme et dans quel état ? » (la liste) et « combien me doit chacun
 * sur la période ? » (les colonnes de revenus, calculées côté serveur par
 * `fn_platform_revenue`).
 */

const PERIODS: readonly { value: RevenuePeriod; label: string }[] = [
  { value: 'month', label: 'Mois en cours' },
  { value: 'previous-month', label: 'Mois clos' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];

export default function RestaurantsPage() {
  const { access, selectRestaurant } = useRestaurantContext();
  const [period, setPeriod] = useState<RevenuePeriod>('month');
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const restaurants = useAllRestaurants(access.platform);
  const revenue = usePlatformRevenue(period, access.platform);

  // `fn_platform_revenue` fait déjà un LEFT JOIN sur tous les restaurants :
  // elle renvoie une ligne même pour un partenaire sans une seule commande.
  // C'est donc elle qui porte la liste ; `useAllRestaurants` ne sert plus qu'à
  // l'adresse et à l'état de service.
  const byId = useMemo(
    () => new Map((restaurants.data ?? []).map((item) => [item.id, item])),
    [restaurants.data],
  );

  const rows = useMemo(() => {
    const all = revenue.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;

    return all.filter((row) => {
      const restaurant = byId.get(row.restaurant_id);
      return (
        row.restaurant_name.toLowerCase().includes(term) ||
        restaurant?.city.toLowerCase().includes(term) ||
        restaurant?.address_line.toLowerCase().includes(term)
      );
    });
  }, [revenue.data, byId, search]);

  const totals = useMemo(
    () =>
      (revenue.data ?? []).reduce(
        (sum, row) => ({
          gross: sum.gross + row.gross_sales,
          commission: sum.commission + row.commission_due,
          orders: sum.orders + row.orders_delivered,
        }),
        { gross: 0, commission: 0, orders: 0 },
      ),
    [revenue.data],
  );

  const published = (restaurants.data ?? []).filter((item) => item.is_published).length;
  const range = revenueRange(period);
  const loading = revenue.isLoading || restaurants.isLoading;

  if (!access.platform) {
    return (
      <EmptyState
        title="Réservé à la plateforme"
        description="Cette page liste tous les partenaires Istanbul. Votre accès porte sur votre propre établissement."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Partenaires"
        description={`${restaurants.data?.length ?? 0} établissements · ${published} publiés dans l’app client`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, commune…"
              className={`${inputClass} sm:w-64`}
              aria-label="Rechercher un partenaire"
            />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden />
              Ouvrir un établissement
            </Button>
          </div>
        }
      />

      {/* --- Revenus ------------------------------------------------------ */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
              Revenus de la plateforme
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Du {range.from.toLocaleDateString('fr-FR')} au {range.to.toLocaleDateString('fr-FR')}
            </p>
          </div>
          <FilterChips
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            label="Période d’analyse"
          />
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : revenue.isError ? (
          <ErrorState
            message={toUserMessage(revenue.error)}
            onRetry={() => void revenue.refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Ventes des partenaires" value={formatMoney(totals.gross)} />
            <Kpi
              label="Commission due"
              value={formatMoney(totals.commission)}
              hint={
                totals.commission === 0
                  ? 'Aucun taux paramétré : réglez la commission dans la fiche de chaque partenaire.'
                  : undefined
              }
              emphasis
            />
            <Kpi label="Commandes livrées" value={String(totals.orders)} />
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
          Assiette : le sous-total des commandes <strong>livrées</strong>, hors frais de livraison
          (reversés aux livreurs) et hors frais de service. Le taux s’applique à l’historique —
          modifier une commission recalcule les périodes passées tant qu’aucune facture n’est
          émise.
        </p>
      </Card>

      {/* --- Liste -------------------------------------------------------- */}
      <Card padded={false} className="px-5 pb-2 pt-4">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : restaurants.isError ? (
          <ErrorState
            message={toUserMessage(restaurants.error)}
            onRetry={() => void restaurants.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={search ? 'Aucun résultat' : 'Aucun partenaire'}
            description={
              search
                ? 'Essayez un autre nom ou une autre commune.'
                : 'Ouvrez le premier établissement pour démarrer la place de marché.'
            }
            action={
              search ? undefined : (
                <Button onClick={() => setCreateOpen(true)}>Ouvrir un établissement</Button>
              )
            }
          />
        ) : (
          <Table responsive ariaLabel="Liste des partenaires">
            <thead>
              <tr>
                <Th>Établissement</Th>
                <Th>État</Th>
                <Th align="right">Livrées</Th>
                <Th align="right">Ventes</Th>
                <Th align="right">Commission</Th>
                <Th align="right">Net partenaire</Th>
                <Th align="right">Gérer</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PartnerRow
                  key={row.restaurant_id}
                  row={row}
                  restaurant={byId.get(row.restaurant_id) ?? null}
                  onOpen={() => selectRestaurant(row.restaurant_id)}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateRestaurantModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: emphasis ? 'var(--color-primary)' : 'var(--color-border)',
        background: emphasis ? 'var(--color-primary-soft)' : 'var(--color-surface-sunken)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className="tabular mt-1.5 text-2xl font-bold"
        style={{
          fontFamily: 'var(--font-sora)',
          color: emphasis ? 'var(--color-on-primary-soft)' : 'var(--color-text)',
        }}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function PartnerRow({
  row,
  restaurant,
  onOpen,
}: {
  row: PlatformRevenueRow;
  restaurant: Restaurant | null;
  onOpen: () => void;
}) {
  return (
    <tr>
      <Td label="Établissement">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-surface-sunken)' }}
            aria-hidden
          >
            <Buildings size={18} className="text-[var(--color-text-muted)]" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.restaurant_name}</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {restaurant ? `${restaurant.address_line} · ${restaurant.city}` : '—'}
            </p>
          </div>
        </div>
      </Td>

      <Td label="État">
        {/* Chaque état est nommé, pas seulement coloré : « publié mais fermé »
            et « non publié » se ressemblent sur un simple point de couleur. */}
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={row.is_published ? 'success' : 'neutral'} dot>
            {row.is_published ? 'Publié' : 'Non publié'}
          </Badge>
          {restaurant ? (
            <Badge tone={restaurant.is_accepting_orders ? 'info' : 'warning'} dot>
              {restaurant.is_accepting_orders ? 'Ouvert aux commandes' : 'Commandes suspendues'}
            </Badge>
          ) : null}
        </div>
      </Td>

      <Td label="Livrées" align="right">
        <span className="tabular">{row.orders_delivered}</span>
      </Td>

      <Td label="Ventes" align="right">
        <span className="tabular">{formatMoney(row.gross_sales)}</span>
      </Td>

      <Td label="Commission" align="right">
        <span className="tabular font-semibold">{formatMoney(row.commission_due)}</span>
        <span className="tabular block text-xs text-[var(--color-text-muted)]">
          {(row.commission_bps / 100).toFixed(row.commission_bps % 100 ? 1 : 0)} %
        </span>
      </Td>

      <Td label="Net partenaire" align="right">
        <span className="tabular">{formatMoney(row.net_to_partner)}</span>
      </Td>

      <Td label="Gérer" align="right">
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Basculer
          <ArrowRight size={16} aria-hidden />
        </Button>
      </Td>
    </tr>
  );
}

// ---------------------------------------------------------------------------

/** Coordonnées du centre de Kinshasa : point de départ raisonnable. */
const KINSHASA = { latitude: -4.3276, longitude: 15.3136 };

function CreateRestaurantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateRestaurant();
  const { selectRestaurant } = useRestaurantContext();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    addressLine: '',
    city: 'Kinshasa',
    latitude: String(KINSHASA.latitude),
    longitude: String(KINSHASA.longitude),
    ownerEmail: '',
    commissionBps: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.addressLine.trim()) {
      setError('Nom, téléphone et adresse sont obligatoires.');
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Coordonnées invalides.');
      return;
    }

    setError(null);
    create.mutate(
      {
        name: form.name.trim(),
        phone: form.phone.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim() || 'Kinshasa',
        latitude,
        longitude,
        ownerEmail: form.ownerEmail.trim() || null,
        commissionBps: form.commissionBps,
      },
      {
        onSuccess: (restaurant) => {
          toast.success(`${restaurant.name} est ouvert. Il reste à monter la carte.`);
          selectRestaurant(restaurant.id);
          close();
        },
        onError: (mutationError) => setError(toUserMessage(mutationError)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Ouvrir un établissement"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={create.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={create.isPending}>
            Ouvrir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning">
          L’établissement est créé <strong>fermé et non publié</strong>, avec des horaires 10h–22h
          et trois tranches de livraison par défaut. Le partenaire monte sa carte, puis publie
          lui-même depuis sa page « Établissement ».
        </Alert>

        {error ? <Alert>{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l’enseigne" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Istanbul Delvaux"
            />
          </Field>

          <Field label="Téléphone" required>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              placeholder="+243 …"
            />
          </Field>

          <Field label="Adresse" required>
            <input
              className={inputClass}
              value={form.addressLine}
              onChange={(event) => set('addressLine', event.target.value)}
            />
          </Field>

          <Field label="Commune / ville">
            <input
              className={inputClass}
              value={form.city}
              onChange={(event) => set('city', event.target.value)}
            />
          </Field>

          <Field
            label="Latitude"
            hint="Base du calcul de distance : une erreur ici fausse tous les frais de livraison."
          >
            <input
              className={`${inputClass} tabular`}
              type="number"
              step="0.000001"
              inputMode="decimal"
              value={form.latitude}
              onChange={(event) => set('latitude', event.target.value)}
            />
          </Field>

          <Field label="Longitude">
            <input
              className={`${inputClass} tabular`}
              type="number"
              step="0.000001"
              inputMode="decimal"
              value={form.longitude}
              onChange={(event) => set('longitude', event.target.value)}
            />
          </Field>

          <Field
            label="E-mail du propriétaire"
            hint="Le compte doit déjà exister. Laissez vide pour rattacher quelqu’un plus tard."
          >
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              value={form.ownerEmail}
              onChange={(event) => set('ownerEmail', event.target.value)}
            />
          </Field>

          <Field label="Commission (%)" hint="Part prélevée par la plateforme sur chaque commande.">
            <input
              className={`${inputClass} tabular`}
              type="number"
              min={0}
              max={50}
              step="0.5"
              inputMode="decimal"
              value={form.commissionBps / 100}
              onChange={(event) =>
                set('commissionBps', Math.round(Number(event.target.value) * 100))
              }
            />
          </Field>
        </div>

        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
          Panier minimum, frais de service et temps de préparation se règlent ensuite depuis la
          page « Établissement » du partenaire — ce sont ses paramètres, pas les nôtres.
        </p>
      </div>
    </Modal>
  );
}
