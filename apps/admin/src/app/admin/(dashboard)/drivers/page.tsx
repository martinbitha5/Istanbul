'use client';

import { useState } from 'react';
import {
  driverAvailabilityLabel,
  formatMoney,
  formatPhone,
  formatRelative,
  useAdminDrivers,
  useApproveDriver,
  vehicleLabel,
} from '@istanbul/core';
import type { Driver } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  SortableTh,
  Table,
  TableSkeleton,
  Td,
  Th,
  useSort,
} from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useRestaurantAccess } from '@/providers/RestaurantProvider';
import { EnrollDriverModal } from './EnrollDriverModal';

/**
 * Livreurs.
 *
 * L'approbation est le seul geste vraiment sensible ici : un livreur non
 * approuvé ne voit aucune course, même en étant connecté (policy
 * `deliveries_read_driver`).
 */
type SortKey = 'name' | 'availability' | 'total_deliveries' | 'total_earnings' | 'last_location_at';

export default function DriversPage() {
  const restaurantId = useRestaurantId();
  const drivers = useAdminDrivers(restaurantId);
  const approve = useApproveDriver();
  const toast = useToast();

  const access = useRestaurantAccess();

  // Spinner uniquement sur la ligne cliquée (approve.isPending était partagé).
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<Driver | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  // Les disponibles d'abord : en plein service, c'est la seule ligne qu'on
  // cherche. L'ordre de l'enum (OFFLINE, AVAILABLE, BUSY) ne correspond pas à
  // l'ordre utile, d'où le rang explicite.
  const availabilityRank: Record<string, number> = { AVAILABLE: 2, BUSY: 1, OFFLINE: 0 };

  const { state: sortState, onSort, sort } = useSort<Driver, SortKey>(
    { key: 'availability', direction: 'desc' },
    (driver, key) => {
      switch (key) {
        case 'name':
          return driver.profile?.full_name ?? '';
        case 'availability':
          return availabilityRank[driver.availability] ?? 0;
        case 'last_location_at':
          return driver.last_location_at;
        default:
          return driver[key];
      }
    },
  );

  const list = sort(drivers.data ?? []);
  const online = list.filter((driver) => driver.availability !== 'OFFLINE').length;

  const handleApprove = (driverId: string, isApproved: boolean) => {
    setApprovingId(driverId);
    approve.mutate(
      { driverId, isApproved },
      {
        onSuccess: () => {
          toast.success(isApproved ? 'Livreur approuvé' : 'Livreur suspendu');
          setSuspending(null);
        },
        onSettled: () => setApprovingId(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Livreurs"
        description={`${online} en ligne sur ${list.length}`}
        action={
          access.manage ? (
            <Button onClick={() => setEnrollOpen(true)}>Ajouter un livreur</Button>
          ) : null
        }
      />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {drivers.isLoading ? (
          <TableSkeleton rows={4} />
        ) : drivers.isError ? (
          <ErrorState onRetry={() => void drivers.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Aucun livreur"
            description="Enrôlez votre premier livreur : son compte est créé ici, et il se connecte ensuite à l’application livreur."
            action={
              access.manage ? (
                <Button onClick={() => setEnrollOpen(true)}>Ajouter un livreur</Button>
              ) : null
            }
          />
        ) : (
          <Table responsive ariaLabel="Liste des livreurs">
            <thead>
              <tr>
                <SortableTh sortKey="name" state={sortState} onSort={onSort}>
                  Livreur
                </SortableTh>
                <Th>Véhicule</Th>
                <SortableTh sortKey="availability" state={sortState} onSort={onSort}>
                  Statut
                </SortableTh>
                <SortableTh
                  sortKey="total_deliveries"
                  state={sortState}
                  onSort={onSort}
                  align="right"
                >
                  Livraisons
                </SortableTh>
                <SortableTh
                  sortKey="total_earnings"
                  state={sortState}
                  onSort={onSort}
                  align="right"
                >
                  Gains cumulés
                </SortableTh>
                <SortableTh sortKey="last_location_at" state={sortState} onSort={onSort}>
                  Position
                </SortableTh>
                <Th align="right">Approbation</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((driver) => (
                <tr key={driver.id}>
                  <Td label="Livreur">
                    <div className="flex items-center gap-3">
                      <Avatar name={driver.profile?.full_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {driver.profile?.full_name ?? 'Sans nom'}
                        </p>
                        {driver.profile?.phone ? (
                          // Lien tel: — depuis le téléphone de la caisse, un
                          // tap suffit pour appeler le livreur.
                          <a
                            href={`tel:${driver.profile.phone}`}
                            className="tabular text-xs text-[var(--color-info)] underline-offset-2 hover:underline"
                          >
                            {formatPhone(driver.profile.phone)}
                          </a>
                        ) : (
                          <p className="tabular text-xs text-[var(--color-text-muted)]">—</p>
                        )}
                      </div>
                    </div>
                  </Td>

                  <Td label="Véhicule">
                    <span className="text-sm">{vehicleLabel[driver.vehicle]}</span>
                    {driver.plate_number ? (
                      <p className="text-xs text-[var(--color-text-muted)]">{driver.plate_number}</p>
                    ) : null}
                  </Td>

                  <Td label="Statut">
                    <Badge
                      tone={
                        driver.availability === 'AVAILABLE'
                          ? 'success'
                          : driver.availability === 'BUSY'
                            ? 'warning'
                            : 'neutral'
                      }
                      dot
                    >
                      {driverAvailabilityLabel[driver.availability]}
                    </Badge>
                  </Td>

                  <Td label="Livraisons" align="right">
                    <span className="tabular">{driver.total_deliveries}</span>
                  </Td>

                  <Td label="Gains cumulés" align="right">
                    <span className="tabular font-semibold">
                      {formatMoney(driver.total_earnings)}
                    </span>
                  </Td>

                  <Td label="Position">
                    {driver.last_location_at ? (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatRelative(driver.last_location_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">—</span>
                    )}
                  </Td>

                  <Td align="right">
                    {driver.is_approved ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setSuspending(driver)}
                        loading={approvingId === driver.id && approve.isPending}
                      >
                        Suspendre
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(driver.id, true)}
                        loading={approvingId === driver.id && approve.isPending}
                      >
                        Approuver
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <EnrollDriverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        restaurantId={restaurantId}
      />

      <ConfirmDialog
        open={suspending !== null}
        title="Suspendre le livreur"
        message={`Retirer l’approbation de ${suspending?.profile?.full_name ?? 'ce livreur'} ? Il ne verra plus aucune course.`}
        confirmLabel="Suspendre"
        loading={approve.isPending}
        onClose={() => setSuspending(null)}
        onConfirm={() => {
          if (!suspending) return;
          handleApprove(suspending.id, false);
        }}
      />
    </div>
  );
}
