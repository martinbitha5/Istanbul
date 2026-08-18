'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
import { useRestaurantId } from '@/hooks/useRestaurantId';

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

  const stats = useDashboardStats(restaurantId);
  const series = useSalesSeries(restaurantId, bucket);
  const topProducts = useTopProducts(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId);
  const setAccepting = useSetAcceptingOrders();

  // Rafraîchit les KPIs dès qu'une commande tombe, sans attendre le poll.
  useOrderQueueRealtime(restaurantId);

  return (
    <div className="space-y-8">
      {/* --- En-tête ---------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-sora)' }}>
            Vue d’ensemble
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Activité du jour · {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}
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
              onChange={(value) =>
                setAccepting.mutate({ restaurantId, accepting: value })
              }
              label="Accepter les commandes"
            />
          </Card>
        ) : null}
      </div>

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
            hint={`Panier moyen ${stats.data ? formatMoney(stats.data.avg_basket) : '—'}`}
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
            count={stats.data?.orders_new ?? 0}
            tone="warning"
            href="/orders?status=NEW"
          />
          <QueueTile
            label="En préparation"
            count={stats.data?.orders_preparing ?? 0}
            tone="info"
            href="/orders?status=PREPARING"
          />
          <QueueTile
            label="Prêtes"
            count={stats.data?.orders_ready ?? 0}
            tone="info"
            href="/orders?status=READY"
          />
          <QueueTile
            label="En livraison"
            count={stats.data?.orders_in_transit ?? 0}
            tone="neutral"
            href="/orders?status=PICKED_UP"
          />
        </div>
      </Card>

      {/* --- Ventes ------------------------------------------------------ */}
      <Card>
        <SectionTitle
          title="Évolution des ventes"
          action={
            <div className="flex gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1">
              {(['day', 'week', 'month'] as SalesBucket[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setBucket(value)}
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
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(series.data ?? []).map((point) => ({
                  label: formatBucket(point.bucket, bucket),
                  revenue: point.revenue / 100,
                  orders: point.orders,
                }))}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--color-divider)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value} $`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Chiffre d’affaires"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* --- Top produits ------------------------------------------------ */}
      <Card>
        <SectionTitle title="Produits les plus vendus" description="30 derniers jours" />

        {topProducts.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (topProducts.data?.length ?? 0) === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
            Pas encore assez de données.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(topProducts.data ?? []).map((product) => ({
                  name:
                    product.product_name.length > 18
                      ? `${product.product_name.slice(0, 17)}…`
                      : product.product_name,
                  quantity: product.quantity,
                  revenue: product.revenue / 100,
                }))}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--color-divider)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip unit=" vendus" />} cursor={{ fill: 'var(--color-surface-sunken)' }} />
                <Bar dataKey="quantity" name="Quantité" radius={[0, 6, 6, 0]}>
                  {(topProducts.data ?? []).map((_, index) => (
                    <Cell
                      key={index}
                      fill={index === 0 ? 'var(--color-primary)' : 'var(--color-accent)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
  return (
    <Card className={accent ? 'border-transparent' : ''}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        {icon ? <span style={{ color: 'var(--color-primary)' }}>{icon}</span> : null}
      </div>

      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p
          className="tabular mt-2 text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-sora)' }}
        >
          {value}
        </p>
      )}

      {hint ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
    </Card>
  );
}

function QueueTile({
  label,
  count,
  tone,
  href,
}: {
  label: string;
  count: number;
  tone: 'warning' | 'info' | 'neutral';
  href: string;
}) {
  return (
    <Link
      href={href as never}
      className="rounded-xl border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-primary)]"
    >
      <p className="tabular text-3xl font-bold" style={{ fontFamily: 'var(--font-sora)' }}>
        {count}
      </p>
      <div className="mt-2">
        <Badge tone={tone} dot>
          {label}
        </Badge>
      </div>
    </Link>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit = ' $',
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs"
      style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-2)' }}
    >
      <p className="font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="tabular mt-0.5 text-[var(--color-text-secondary)]">
          {entry.name} : {entry.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

function formatBucket(iso: string, bucket: SalesBucket): string {
  const date = new Date(iso);
  if (bucket === 'month') {
    return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
