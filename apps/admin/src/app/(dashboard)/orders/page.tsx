'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  formatRelative,
  nextOrderStatus,
  orderNextActionLabel,
  orderStatusLabel,
  orderStatusTone,
  summarizeOptions,
  toUserMessage,
  useAdvanceOrderStatus,
  useAssignDriver,
  useAssignableDrivers,
  useConfirmationCode,
  useOrderQueue,
  useOrderQueueRealtime,
} from '@istanbul/core';
import type { OrderDetail, OrderStatus } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  SectionTitle,
  Table,
  TableSkeleton,
  Td,
  Th,
  inputClass,
} from '@/components/ui';
import { useRestaurantId } from '@/hooks/useRestaurantId';

const FILTERS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'ACCEPTED', label: 'Acceptées' },
  { value: 'PREPARING', label: 'En préparation' },
  { value: 'READY', label: 'Prêtes' },
  { value: 'ASSIGNED', label: 'Assignées' },
  { value: 'PICKED_UP', label: 'En livraison' },
  { value: 'DELIVERED', label: 'Livrées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <OrdersQueue />
    </Suspense>
  );
}

/**
 * File des commandes.
 *
 * Écran de coup de feu : chaque ligne porte son action suivante directement,
 * sans ouvrir de détail. Le détail existe pour vérifier une note ou un
 * numéro, pas pour faire avancer la commande.
 */
function OrdersQueue() {
  const restaurantId = useRestaurantId();
  const params = useSearchParams();

  const [filter, setFilter] = useState<OrderStatus | 'ALL'>(
    (params.get('status') as OrderStatus | null) ?? 'ALL',
  );
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [assigning, setAssigning] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queue = useOrderQueue({
    restaurantId,
    statuses: filter === 'ALL' ? undefined : [filter],
    search: search.trim() || undefined,
  });

  const advance = useAdvanceOrderStatus();

  // Notification sonore à chaque nouvelle commande : personne ne fixe l'écran
  // en plein service.
  useOrderQueueRealtime(restaurantId, () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Nouvelle commande', { body: 'Une commande vient d’arriver.' });
      }
    }
  });

  const orders = queue.data ?? [];

  const handleAdvance = async (order: OrderDetail) => {
    const next = nextOrderStatus(order.status, order.fulfillment);
    if (!next) return;

    if (next === 'ASSIGNED') {
      setAssigning(order);
      return;
    }

    setError(null);
    try {
      await advance.mutateAsync({ orderId: order.id, to: next });
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Commandes"
        description="Mise à jour en temps réel. Acceptez, préparez, assignez."
        action={
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="N° de commande, nom, téléphone…"
            className={`${inputClass} sm:w-72`}
            aria-label="Rechercher une commande"
          />
        }
      />

      {/* --- Filtres ----------------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              aria-pressed={active}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      ) : null}

      {/* --- Liste ------------------------------------------------------- */}
      <Card padded={false} className="px-5 pb-2 pt-4">
        {queue.isLoading ? (
          <TableSkeleton rows={6} />
        ) : queue.isError ? (
          <ErrorState onRetry={() => void queue.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="Aucune commande"
            description={
              filter === 'ALL'
                ? 'Les nouvelles commandes apparaîtront ici automatiquement.'
                : 'Aucune commande dans ce statut pour le moment.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Commande</Th>
                <Th>Client</Th>
                <Th>Contenu</Th>
                <Th>Mode</Th>
                <Th align="right">Total</Th>
                <Th>Statut</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const next = nextOrderStatus(order.status, order.fulfillment);
                const actionLabel = orderNextActionLabel[order.status];

                return (
                  <tr key={order.id} className="align-top">
                    <Td>
                      <button
                        onClick={() => setDetail(order)}
                        className="text-left font-semibold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {order.order_number}
                      </button>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {formatRelative(order.created_at)}
                      </p>
                    </Td>

                    <Td>
                      <p className="font-medium">{order.contact_name}</p>
                      <p className="tabular text-xs text-[var(--color-text-muted)]">
                        {formatPhone(order.contact_phone)}
                      </p>
                    </Td>

                    <Td className="max-w-xs">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {order.items
                          .map((item) => `${item.quantity}× ${item.product_name}`)
                          .join(', ')}
                      </p>
                      {order.customer_note ? (
                        <p className="mt-1 text-xs" style={{ color: 'var(--color-warning)' }}>
                          ⚠ {order.customer_note}
                        </p>
                      ) : null}
                    </Td>

                    <Td>
                      <Badge tone={order.fulfillment === 'DELIVERY' ? 'info' : 'neutral'}>
                        {order.fulfillment === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                      </Badge>
                      {order.delivery_commune ? (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {order.delivery_commune}
                        </p>
                      ) : null}
                    </Td>

                    <Td align="right">
                      <span className="tabular font-semibold">
                        {formatMoney(order.total, order.currency)}
                      </span>
                    </Td>

                    <Td>
                      <Badge tone={orderStatusTone[order.status]} dot>
                        {orderStatusLabel[order.status]}
                      </Badge>
                    </Td>

                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        {next && actionLabel ? (
                          <Button
                            size="sm"
                            onClick={() => void handleAdvance(order)}
                            loading={advance.isPending}
                          >
                            {actionLabel}
                          </Button>
                        ) : null}

                        {order.status === 'NEW' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void advance
                                .mutateAsync({
                                  orderId: order.id,
                                  to: 'CANCELLED',
                                  note: 'Refusée par le restaurant',
                                })
                                .catch((caught) => setError(toUserMessage(caught)))
                            }
                          >
                            Refuser
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <OrderDetailModal order={detail} onClose={() => setDetail(null)} />
      <AssignDriverModal order={assigning} onClose={() => setAssigning(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrderDetailModal({ order, onClose }: { order: OrderDetail | null; onClose: () => void }) {
  if (!order) return null;

  return (
    <Modal open onClose={onClose} title={`Commande ${order.order_number}`} wide>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoBlock label="Client">
            <p className="font-medium">{order.contact_name}</p>
            <p className="tabular text-sm text-[var(--color-text-secondary)]">
              {formatPhone(order.contact_phone)}
            </p>
          </InfoBlock>

          <InfoBlock label={order.fulfillment === 'DELIVERY' ? 'Adresse' : 'Mode'}>
            {order.fulfillment === 'DELIVERY' ? (
              <>
                <p className="text-sm">{order.delivery_address}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {order.delivery_commune}
                </p>
                {order.delivery_details ? (
                  <p className="text-xs text-[var(--color-text-muted)]">{order.delivery_details}</p>
                ) : null}
                {order.delivery_notes ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-warning)' }}>
                    {order.delivery_notes}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm">Retrait au comptoir</p>
            )}
          </InfoBlock>

          <InfoBlock label="Passée le">
            <p className="text-sm">{formatDateTime(order.created_at)}</p>
          </InfoBlock>

          <InfoBlock label="Paiement">
            <p className="text-sm">
              {order.payment?.provider === 'CASH' ? 'Espèces à la livraison' : order.payment?.provider}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{order.payment?.status}</p>
          </InfoBlock>
        </div>

        {/* --- Lignes --------------------------------------------------- */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Contenu
          </h3>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3 border-b border-[var(--color-divider)] pb-3">
                <span className="tabular w-8 shrink-0 font-semibold">{item.quantity}×</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  {item.options.length > 0 ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {summarizeOptions(
                        item.options.map((option) => ({ option_name: option.option_name })),
                      )}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                      ⚠ {item.note}
                    </p>
                  ) : null}
                </div>
                <span className="tabular shrink-0 font-semibold">
                  {formatMoney(item.line_total, order.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* --- Totaux --------------------------------------------------- */}
        <div className="space-y-1.5 text-sm">
          <TotalRow label="Sous-total" value={formatMoney(order.subtotal, order.currency)} />
          {order.delivery_fee > 0 ? (
            <TotalRow label="Livraison" value={formatMoney(order.delivery_fee, order.currency)} />
          ) : null}
          {order.service_fee > 0 ? (
            <TotalRow label="Frais de service" value={formatMoney(order.service_fee, order.currency)} />
          ) : null}
          {order.discount_amount > 0 ? (
            <TotalRow
              label={`Réduction ${order.promotion_code ?? ''}`}
              value={`−${formatMoney(order.discount_amount, order.currency)}`}
            />
          ) : null}
          <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular">{formatMoney(order.total, order.currency)}</span>
          </div>
        </div>

        {/* --- Historique ----------------------------------------------- */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Historique
          </h3>
          <ol className="space-y-2">
            {order.history.map((event) => (
              <li key={event.id} className="flex items-center gap-3 text-sm">
                <span className="tabular w-32 shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDateTime(event.created_at)}
                </span>
                <Badge tone={orderStatusTone[event.to_status]}>
                  {orderStatusLabel[event.to_status]}
                </Badge>
                {event.note ? (
                  <span className="text-xs text-[var(--color-text-muted)]">{event.note}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {order.delivery ? <DeliveryBlock order={order} /> : null}
      </div>
    </Modal>
  );
}

function AssignDriverModal({ order, onClose }: { order: OrderDetail | null; onClose: () => void }) {
  const restaurantId = useRestaurantId();
  const { data: drivers, isLoading } = useAssignableDrivers(restaurantId);
  const assign = useAssignDriver();
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const handleAssign = async (driverId: string) => {
    setError(null);
    try {
      await assign.mutateAsync({ orderId: order.id, driverId });
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Assigner un livreur — ${order.order_number}`}>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : (drivers?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aucun livreur disponible"
          description="Aucun livreur approuvé n’est en ligne. Vérifiez la page Livreurs."
        />
      ) : (
        <ul className="space-y-2">
          {drivers!.map((driver) => (
            <li
              key={driver.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{driver.profile?.full_name ?? 'Livreur'}</p>
                <p className="tabular text-xs text-[var(--color-text-muted)]">
                  {formatPhone(driver.profile?.phone)} · {driver.total_deliveries} livraisons
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={driver.availability === 'AVAILABLE' ? 'success' : 'warning'} dot>
                  {driver.availability === 'AVAILABLE' ? 'Disponible' : 'En course'}
                </Badge>
                <Button size="sm" onClick={() => void handleAssign(driver.id)} loading={assign.isPending}>
                  Assigner
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/**
 * Bloc livraison.
 *
 * Le code de confirmation passe par une RPC dédiée : la colonne n'est pas
 * lisible directement, y compris par le staff (migration 09).
 */
function DeliveryBlock({ order }: { order: OrderDetail }) {
  const { data: code } = useConfirmationCode(order.id, order.status !== 'DELIVERED');

  return (
    <InfoBlock label="Livraison">
      <p className="text-sm">
        Livreur : {order.delivery?.driver?.profile?.full_name ?? 'Non assigné'}
      </p>
      <p className="tabular text-sm text-[var(--color-text-secondary)]">
        Code de confirmation : {code ?? '—'}
      </p>
    </InfoBlock>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-sunken)] p-3.5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[var(--color-text-secondary)]">
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
