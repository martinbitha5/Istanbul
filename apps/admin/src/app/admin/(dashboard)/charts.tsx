'use client';

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
import { formatMoney, type SalesBucket } from '@istanbul/core';

/**
 * Graphes Recharts de la vue d'ensemble.
 *
 * Fichier séparé chargé via next/dynamic (ssr: false) depuis page.tsx :
 * Recharts pèse ~100 ko et n'a rien à faire dans le bundle initial de la
 * première route — les KPIs s'affichent d'abord, les graphes suivent.
 */

export interface SalesPoint {
  bucket: string;
  revenue: number;
  orders: number;
}

export interface TopProductPoint {
  product_name: string;
  quantity: number;
  revenue: number;
}

export function SalesChart({
  data,
  bucket,
  currency,
}: {
  data: SalesPoint[];
  bucket: SalesBucket;
  currency?: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.map((point) => ({
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
            // Devise du restaurant, plus « $ » en dur.
            tickFormatter={(value: number) => formatMoney(value * 100, currency)}
            width={72}
          />
          <Tooltip
            content={<ChartTooltip format={(value) => formatMoney(value * 100, currency)} />}
          />
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
  );
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.map((product) => ({
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
          <Tooltip
            content={<ChartTooltip format={(value) => `${value} vendus`} />}
            cursor={{ fill: 'var(--color-surface-sunken)' }}
          />
          <Bar dataKey="quantity" name="Quantité" radius={[0, 6, 6, 0]}>
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={index === 0 ? 'var(--color-primary)' : 'var(--color-accent)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  format = (value) => String(value),
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
  format?: (value: number) => string;
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
          {entry.name} : {format(entry.value)}
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
