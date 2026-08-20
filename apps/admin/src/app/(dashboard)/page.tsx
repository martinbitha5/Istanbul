'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CurrencyDollar, Package, Users } from '@phosphor-icons/react';
import {
  formatMoney,
  useDashboardStats,
  useOrderQueueRealtime,
  useRestaurant,
  useSalesSeries,
  useSetAcceptingOrders,
  useTopProducts,
  type SalesBucket,
} from '@istanbul/core';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  SectionTitle,
  Skeleton,
  Toggle,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';

// Recharts (~100 ko) chargé à la demande, hors du bundle initial de la
// première route : les KPIs s'affichent tout de suite, les graphes suivent.
const SalesChart = dynamic(() => import('./charts').then((mod) => mod.SalesChart), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});
const TopProductsChart = dynamic(() => import('./charts').then((mod) => mod.TopProductsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

// Checklist de mise en route : utile une fois dans la vie du restaurant, donc
// hors du bundle initial et montée seulement tant que la carte n'est pas
// publiée. Elle interroge le menu, les catégories, les zones et les horaires —
// quatre requêtes qui n'ont rien à faire sur l'écran d'un service en cours.
const OnboardingBanner = dynamic(
  () => import('@/components/OnboardingBanner').then((mod) => mod.OnboardingBanner),
  { ssr: false },
);

/**
 * Vue d'ensemble.
 *
 * Trois questions auxquelles le gérant doit répondre en cinq secondes :
 * combien j'ai fait aujourd'hui, qu'est-ce qui attend en cuisine, et qu'est-ce
 * qui se vend.
 */
export default function DashboardPage() {
  const restaurantId = useRestaurantId();
  const [bucket, setBucket] = useState<SalesBucket>('day');
  const [confirmClosing, setConfirmClosing] = useState(false);

  const stats = useDashboardStats(restaurantId);
  const series = useSalesSeries(restaurantId, bucket);
  const topProducts = useTopProducts(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId);
  const setAccepting = useSetAcceptingOrders();
  const toast = useToast();

  // Rafraîchit les KPIs dès qu'une commande tombe, sans attendre le poll.
  useOrderQueueRealtime(restaurantId);

  const applyAccepting = (accepting: boolean) => {
    setAccepting.mutate(
      { restaurantId, accepting },
      {
        onSuccess: () => {
          toast.success(
            accepting
              ? 'Commandes ouvertes : les clients peuvent commander.'
              : 'Commandes fermées : le menu reste consultable.',
          );
          setConfirmClosing(false);
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      {/* --- En-tête ---------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Vue d’ensemble
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}
          </p>
        </div>

        {restaurant ? (
          <Card className="flex items-center gap-4">
            <div>
              <p className="text-sm font-semibold">
                {restaurant.is_accepting_orders ? 'Commandes ouvertes' : 'Commandes fermées'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {restaurant.is_accepting_orders
                  ? 'Les clients peuvent commander'
                  : 'Le menu reste consultable'}
              </p>
            </div>
            <Toggle
              checked={restaurant.is_accepting_orders}
              onChange={(value) => {
                // Fermer coupe les ventes : on confirme. Rouvrir est sans risque.
                if (!value) {
                  setConfirmClosing(true);
                } else {
                  applyAccepting(true);
                }
              }}
              label="Accepter les commandes"
            />
          </Card>
        ) : null}
      </div>

      {/* Mise en route : rien à charger tant que la carte est en ligne. */}
      {restaurant && !restaurant.is_published ? <OnboardingBanner /> : null}

      <ConfirmDialog
        open={confirmClosing}
        title="Fermer les commandes"
        message="Les clients ne pourront plus commander tant que vous n’aurez pas rouvert. Le menu restera consultable."
        confirmLabel="Fermer les commandes"
        loading={setAccepting.isPending}
        onClose={() => setConfirmClosing(false)}
        onConfirm={() => applyAccepting(false)}
      />

      {/* --- KPIs -------------------------------------------------------- */}
      {stats.isError ? (
        <Card>
          <ErrorState onRetry={() => void stats.refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Chiffre d’affaires"
            value={stats.data ? formatMoney(stats.data.revenue, restaurant?.currency) : null}
            hint={`Panier moyen ${stats.data ? formatMoney(stats.data.avg_basket, restaurant?.currency) : '—'}`}
            icon={<CurrencyDollar size={18} weight="bold" />}
            accent
          />
          <StatCard
            label="Commandes"
            value={stats.data ? String(stats.data.orders_total) : null}
            hint={`${stats.data?.orders_delivered ?? 0} livrées`}
            icon={<Package size={18} weight="bold" />}
          />
          <StatCard
            label="Clients"
            value={stats.data ? String(stats.data.customers) : null}
            hint="Distincts aujourd’hui"
            icon={<Users size={18} weight="bold" />}
          />
          <StatCard
            label="Livreurs actifs"
            value={stats.data ? String(stats.data.drivers_active) : null}
            hint="En ligne ou en course"
          />
        </div>
      )}

      {/* --- File d'attente --------------------------------------------- */}
      <Card>
        <SectionTitle
          title="En cours de traitement"
          description="Cliquez sur un statut pour filtrer la file des commandes."
          action={
            <Link href="/orders">
              <Button variant="secondary" size="sm">
                Ouvrir la file
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QueueTile
            label="Nouvelles"
            count={stats.data ? stats.data.orders_new : null}
            tone="warning"
            href="/orders?status=NEW"
          />
          <QueueTile
            label="En préparation"
            count={stats.data ? stats.data.orders_preparing : null}
            tone="info"
            href="/orders?status=PREPARING"
          />
          <QueueTile
            label="Prêtes"
            count={stats.data ? stats.data.orders_ready : null}
            tone="info"
            href="/orders?status=READY"
          />
          <QueueTile
            label="En livraison"
            count={stats.data ? stats.data.orders_in_transit : null}
            tone="neutral"
            href="/orders?status=PICKED_UP"
          />
        </div>
      </Card>

      {/* --- Ventes ------------------------------------------------------ */}
      <Card>
        {/* Le sélecteur Jour/Semaine/Mois vit dans l'en-tête de CETTE carte :
            il n'agit que sur le graphe, pas sur les KPIs du haut. */}
        <SectionTitle
          title="Évolution des ventes"
          description="La période choisie n’affecte que ce graphe."
          action={
            <div
              className="flex gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1"
              role="group"
              aria-label="Période du graphe des ventes"
            >
              {(['day', 'week', 'month'] as SalesBucket[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setBucket(value)}
                  aria-pressed={bucket === value}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: bucket === value ? 'var(--color-surface)' : 'transparent',
                    color:
                      bucket === value ? 'var(--color-text)' : 'var(--color-text-muted)',
                  }}
                >
                  {value === 'day' ? 'Jour' : value === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
          }
        />

        {series.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : series.isError ? (
          <ErrorState onRetry={() => void series.refetch()} />
        ) : (series.data?.length ?? 0) === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-[var(--color-text-muted)]">
            Aucune vente sur la période.
          </div>
        ) : (
          <SalesChart data={series.data ?? []} bucket={bucket} currency={restaurant?.currency} />
        )}
      </Card>

      {/* --- Top produits ------------------------------------------------ */}
      <Card>
        <SectionTitle title="Produits les plus vendus" description="30 derniers jours" />

        {topProducts.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : topProducts.isError ? (
          <ErrorState onRetry={() => void topProducts.refetch()} />
        ) : (topProducts.data?.length ?? 0) === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
            Pas encore assez de données.
          </div>
        ) : (
          <TopProductsChart data={topProducts.data ?? []} />
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string | null;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  // Les textes secondaires de la carte accent héritent de l'encre et jouent
  // sur l'opacité : le vert vif n'a pas de token muted dédié.
  const mutedClass = accent
    ? 'opacity-75'
    : 'text-[var(--color-text-muted)]';

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>{label}</p>
        {icon ? (
          <span style={{ color: accent ? 'currentColor' : 'var(--color-primary)' }}>{icon}</span>
        ) : null}
      </div>

      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p
          className="tabular mt-2 text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value}
        </p>
      )}

      {hint ? <p className={`mt-1 text-xs ${mutedClass}`}>{hint}</p> : null}
    </>
  );

  // La carte accent reprend le CTA signature de Wise : vert vif, encre dessus.
  if (accent) {
    return (
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-text-on-accent)',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        {body}
      </div>
    );
  }

  return <Card>{body}</Card>;
}

function QueueTile({
  label,
  count,
  tone,
  href,
}: {
  label: string;
  /** null = chargement : squelette plutôt qu'un « 0 » mensonger. */
  count: number | null;
  tone: 'warning' | 'info' | 'neutral';
  href: string;
}) {
  return (
    <Link
      href={href as never}
      className="rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-sunken)]"
    >
      {count === null ? (
        <Skeleton className="h-9 w-12" />
      ) : (
        <p className="tabular text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {count}
        </p>
      )}
      <div className="mt-2">
        <Badge tone={tone} dot>
          {label}
        </Badge>
      </div>
    </Link>
  );
}
