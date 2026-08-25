'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  useDriverLocation,
  useDriverLocationRealtime,
  useDriverTrail,
  useOrderQueue,
  useOrderQueueRealtime,
  useRestaurant,
} from '@istanbul/core';
import type { MapRouteInfo } from '@istanbul/map';
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
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DeliveryMap } from '@/components/DeliveryMap';
import { FilterChips } from '@/components/FilterChips';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNewOrderAlerts } from '@/hooks/useNewOrderAlerts';

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

// Au-delà de dix minutes, une commande NEW non traitée devient un problème :
// on la colore en danger pour qu'elle saute aux yeux.
const STALE_NEW_MS = 10 * 60 * 1000;

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
  const pathname = usePathname();
  const router = useRouter();

  const [filter, setFilterState] = useState<OrderStatus | 'ALL'>(
    (params.get('status') as OrderStatus | null) ?? 'ALL',
  );
  const [search, setSearch] = useState('');
  // Debounce : la clé de requête inclut la chaîne — sans lui, une requête
  // Supabase partait à chaque frappe.
  const debouncedSearch = useDebouncedValue(search, 300);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [assigning, setAssigning] = useState<OrderDetail | null>(null);
  const [rejecting, setRejecting] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Seule la ligne cliquée affiche un spinner (advance.isPending était
  // partagé : toutes les lignes tournaient en même temps).
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Le filtre vit dans l'URL : retour navigateur, partage et rechargement
  // retombent sur la même vue (les tuiles du dashboard pointent déjà ici).
  const setFilter = (value: OrderStatus | 'ALL') => {
    setFilterState(value);
    router.replace(value === 'ALL' ? pathname : `${pathname}?status=${value}`, { scroll: false });
  };

  // Synchronise l'état si l'URL change sans remontage (lien du dashboard
  // cliqué alors que la page est déjà ouverte).
  useEffect(() => {
    const fromUrl = (params.get('status') as OrderStatus | null) ?? 'ALL';
    setFilterState((current) => (current === fromUrl ? current : fromUrl));
  }, [params]);

  const queue = useOrderQueue({
    restaurantId,
    statuses: filter === 'ALL' ? undefined : [filter],
    search: debouncedSearch.trim() || undefined,
  });

  const advance = useAdvanceOrderStatus();

  // Minuteur : re-render toutes les 30 s pour que formatRelative et la
  // détection des commandes en retard restent justes sans interaction.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Alertes de nouvelles commandes : son + notification système + badge
  // d'onglet. La permission se demande via le bouton « Activer les alertes »
  // (l'ancien code testait la permission sans jamais la demander).
  const { permission, requestPermission, notify } = useNewOrderAlerts();
  useOrderQueueRealtime(restaurantId, () => notify());

  const orders = queue.data ?? [];
  const now = Date.now();

  const runAdvance = async (order: OrderDetail, to: OrderStatus, note?: string) => {
    setError(null);
    setPendingOrderId(order.id);
    try {
      await advance.mutateAsync({ orderId: order.id, to, note });
      return true;
    } catch (caught) {
      setError(toUserMessage(caught));
      return false;
    } finally {
      setPendingOrderId(null);
    }
  };

  const handleAdvance = async (order: OrderDetail) => {
    const next = nextOrderStatus(order.status, order.fulfillment);
    if (!next) return;

    if (next === 'ASSIGNED') {
      setAssigning(order);
      return;
    }

    await runAdvance(order, next);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Commandes"
        description="Mise à jour en temps réel. Acceptez, préparez, assignez."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {permission === 'default' ? (
              <Button variant="secondary" size="sm" onClick={() => void requestPermission()}>
                Activer les alertes
              </Button>
            ) : null}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="N° de commande, nom, téléphone…"
              className={`${inputClass} sm:w-72`}
              aria-label="Rechercher une commande"
            />
          </div>
        }
      />

      {/* --- Filtres ----------------------------------------------------- */}
      <FilterChips
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        label="Filtrer par statut"
      />

      {/* Le contenu de la file change tout seul (realtime). Sans région
          live, une personne au lecteur d'écran n'a aucun moyen de savoir
          qu'une commande vient d'arriver : le son et la notification système
          existent déjà, il manquait l'annonce. `polite` et non `assertive` —
          on ne coupe pas la parole à quelqu'un en train de lire une adresse. */}
      <p aria-live="polite" className="sr-only">
        {queue.isLoading
          ? 'Chargement de la file des commandes.'
          : `${orders.length} commande${orders.length > 1 ? 's' : ''} ${
              filter === 'ALL' ? 'dans la file' : `au statut ${orderStatusLabel[filter]}`
            }.`}
      </p>

      {error ? <Alert>{error}</Alert> : null}

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
          <Table responsive ariaLabel="File des commandes">
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
                const isStaleNew =
                  order.status === 'NEW' &&
                  now - new Date(order.created_at).getTime() > STALE_NEW_MS;

                return (
                  <tr key={order.id} className="align-top">
                    <Td label="Commande">
                      {/* Souligné plutôt que coloré : depuis que le primaire
                          est l'encre, une couleur de lien ne se distinguerait
                          plus du texte courant. C'est aussi ce que fait la
                          vitrine pour ses liens en ligne. */}
                      <button
                        onClick={() => setDetail(order)}
                        className="cursor-pointer text-left font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {order.order_number}
                      </button>
                      <p
                        className="mt-0.5 text-xs"
                        style={{
                          // Une NEW qui attend depuis plus de 10 min vire au rouge.
                          color: isStaleNew ? 'var(--color-danger)' : 'var(--color-text-muted)',
                          fontWeight: isStaleNew ? 600 : undefined,
                        }}
                      >
                        {formatRelative(order.created_at)}
                      </p>
                    </Td>

                    <Td label="Client">
                      <p className="font-medium">{order.contact_name}</p>
                      <p className="tabular text-xs text-[var(--color-text-muted)]">
                        {formatPhone(order.contact_phone)}
                      </p>
                    </Td>

                    <Td label="Contenu" className="max-w-xs">
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

                    <Td label="Mode">
                      <Badge tone={order.fulfillment === 'DELIVERY' ? 'info' : 'neutral'}>
                        {order.fulfillment === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                      </Badge>
                      {order.delivery_commune ? (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {order.delivery_commune}
                        </p>
                      ) : null}
                    </Td>

                    <Td label="Total" align="right">
                      <span className="tabular font-semibold">
                        {formatMoney(order.total, order.currency)}
                      </span>
                    </Td>

                    <Td label="Statut">
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
                            loading={pendingOrderId === order.id && advance.isPending}
                          >
                            {actionLabel}
                          </Button>
                        ) : null}

                        {order.status === 'NEW' ? (
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(order)}>
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

      {/* Refus avec motif : le motif part dans p_note de la RPC et se
          retrouve dans l'historique de la commande côté client. */}
      <ConfirmDialog
        // key : remet le champ motif à zéro à chaque nouvelle commande visée.
        key={rejecting?.id ?? 'none'}
        open={rejecting !== null}
        title={`Refuser la commande ${rejecting?.order_number ?? ''}`}
        message="Le client sera notifié que sa commande est annulée. Cette action est définitive."
        confirmLabel="Refuser la commande"
        reasonLabel="Motif du refus"
        reasonPlaceholder="Rupture de stock, fermeture exceptionnelle…"
        loading={advance.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting) return;
          void runAdvance(rejecting, 'CANCELLED', reason ?? 'Refusée par le restaurant').then(
            (ok) => {
              if (ok) setRejecting(null);
            },
          );
        }}
      />
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
  // Spinner uniquement sur le livreur cliqué, pas sur toute la liste.
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null);

  if (!order) return null;

  const handleAssign = async (driverId: string) => {
    setError(null);
    setPendingDriverId(driverId);
    try {
      await assign.mutateAsync({ orderId: order.id, driverId });
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setPendingDriverId(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Assigner un livreur — ${order.order_number}`}>
      {error ? <Alert className="mb-4">{error}</Alert> : null}

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
                <Button
                  size="sm"
                  onClick={() => void handleAssign(driver.id)}
                  loading={pendingDriverId === driver.id && assign.isPending}
                >
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
 *
 * La carte n'apparaît que tant que la course est vivante. Sur une commande
 * livrée, elle n'apprendrait plus rien et coûterait des tuiles à chaque
 * ouverture du détail.
 */
function DeliveryBlock({ order }: { order: OrderDetail }) {
  const restaurantId = useRestaurantId();
  const { data: code } = useConfirmationCode(order.id, order.status !== 'DELIVERED');
  const { data: restaurant } = useRestaurant(restaurantId);

  const delivery = order.delivery ?? null;
  const live = Boolean(
    delivery && !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(delivery.status),
  );

  const { data: driverLocation } = useDriverLocation(delivery?.id ?? null, live);
  const { data: trail } = useDriverTrail(delivery?.id ?? null, live);
  useDriverLocationRealtime(live ? (delivery?.id ?? null) : null);

  const [route, setRoute] = useState<MapRouteInfo | null>(null);

  const destination =
    order.delivery_latitude != null && order.delivery_longitude != null
      ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
      : null;

  return (
    <div className="space-y-3">
      <InfoBlock label="Livraison">
        <p className="text-sm">
          Livreur : {order.delivery?.driver?.profile?.full_name ?? 'Non assigné'}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Code de confirmation</p>
        {/* Grand et tabulaire : ce code se dicte au téléphone en plein service. */}
        <p className="tabular text-2xl font-bold tracking-widest">{code ?? '—'}</p>
      </InfoBlock>

      {live && restaurant ? (
        <div>
          <DeliveryMap
            restaurant={{ latitude: restaurant.latitude, longitude: restaurant.longitude }}
            destination={destination}
            driver={
              driverLocation
                ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
                : null
            }
            trail={trail ?? undefined}
            height={280}
            onRoute={setRoute}
          />

          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {route ? (
              <span className="tabular">
                Itinéraire restant : {route.distanceKm.toLocaleString('fr-FR')} km ·{' '}
                {route.durationMin} min
                {route.source === 'mapbox' ? ' (trafic Mapbox)' : ' (estimation)'}
              </span>
            ) : driverLocation ? (
              'Calcul de l’itinéraire…'
            ) : (
              'En attente de la position du livreur.'
            )}
          </p>
        </div>
      ) : null}
    </div>
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
