'use client';

import {
  driverAvailabilityLabel,
  formatMoney,
  formatPhone,
  formatRelative,
  initials,
  useAdminDrivers,
  useApproveDriver,
  vehicleLabel,
} from '@istanbul/core';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  Table,
  TableSkeleton,
  Td,
  Th,
} from '@/components/ui';
import { useRestaurantId } from '@/hooks/useRestaurantId';

/**
 * Livreurs.
 *
 * L'approbation est le seul geste vraiment sensible ici : un livreur non
 * approuvé ne voit aucune course, même en étant connecté (policy
 * `deliveries_read_driver`).
 */
export default function DriversPage() {
  const restaurantId = useRestaurantId();
  const drivers = useAdminDrivers(restaurantId);
  const approve = useApproveDriver();

  const list = drivers.data ?? [];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Livreurs"
        description={`${list.filter((driver) => driver.availability !== 'OFFLINE').length} en ligne sur ${list.length}`}
      />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {drivers.isLoading ? (
          <TableSkeleton rows={4} />
        ) : drivers.isError ? (
          <ErrorState onRetry={() => void drivers.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Aucun livreur"
            description="Créez un compte avec le rôle DRIVER depuis Supabase, il apparaîtra ici pour approbation."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Livreur</Th>
                <Th>Véhicule</Th>
                <Th>Statut</Th>
                <Th align="right">Livraisons</Th>
                <Th align="right">Gains cumulés</Th>
                <Th>Position</Th>
                <Th align="right">Approbation</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((driver) => (
                <tr key={driver.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          background: 'var(--color-primary-soft)',
                          color: 'var(--color-on-primary-soft)',
                        }}
                      >
                        {initials(driver.profile?.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {driver.profile?.full_name ?? 'Sans nom'}
                        </p>
                        <p className="tabular text-xs text-[var(--color-text-muted)]">
                          {formatPhone(driver.profile?.phone)}
                        </p>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <span className="text-sm">{vehicleLabel[driver.vehicle]}</span>
                    {driver.plate_number ? (
                      <p className="text-xs text-[var(--color-text-muted)]">{driver.plate_number}</p>
                    ) : null}
                  </Td>

                  <Td>
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

                  <Td align="right">
                    <span className="tabular">{driver.total_deliveries}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular font-semibold">
                      {formatMoney(driver.total_earnings)}
                    </span>
                  </Td>

                  <Td>
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
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              `Retirer l’approbation de ${driver.profile?.full_name} ? Il ne verra plus aucune course.`,
                            )
                          ) {
                            approve.mutate({ driverId: driver.id, isApproved: false });
                          }
                        }}
                      >
                        Suspendre
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => approve.mutate({ driverId: driver.id, isApproved: true })}
                        loading={approve.isPending}
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
    </div>
  );
}
