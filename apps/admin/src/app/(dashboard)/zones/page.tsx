'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash, Warning } from '@phosphor-icons/react';
import {
  formatMoney,
  toUserMessage,
  useAdminZones,
  useDeleteZone,
  useRestaurant,
  useSaveZone,
} from '@istanbul/core';
import type { DeliveryZone } from '@istanbul/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  SectionTitle,
  Table,
  TableSkeleton,
  Td,
  Th,
  Toggle,
  inputClass,
} from '@/components/ui';
import { useRestaurantId } from '@/hooks/useRestaurantId';

/**
 * Zones de livraison.
 *
 * Les tranches doivent être contiguës et sans recouvrement : `fn_delivery_quote`
 * prend la première zone dont `min ≤ distance < max`. Un trou dans la
 * couverture se traduit par un « hors zone » au checkout — d'où le contrôle de
 * cohérence affiché ici.
 */
export default function ZonesPage() {
  const restaurantId = useRestaurantId();
  const zones = useAdminZones(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId);
  const saveZone = useSaveZone();
  const deleteZone = useDeleteZone();

  const [editing, setEditing] = useState<Partial<DeliveryZone> | null>(null);

  const list = useMemo(
    () => [...(zones.data ?? [])].sort((a, b) => a.min_distance_km - b.min_distance_km),
    [zones.data],
  );

  // Détection des trous et recouvrements entre tranches actives.
  const issues = useMemo(() => {
    const active = list.filter((zone) => zone.is_active);
    const problems: string[] = [];

    for (let index = 1; index < active.length; index += 1) {
      const previous = active[index - 1]!;
      const current = active[index]!;

      if (current.min_distance_km > previous.max_distance_km) {
        problems.push(
          `Trou de couverture entre ${previous.max_distance_km} km et ${current.min_distance_km} km.`,
        );
      } else if (current.min_distance_km < previous.max_distance_km) {
        problems.push(
          `Recouvrement entre « ${previous.name} » et « ${current.name} » : la première l’emporte.`,
        );
      }
    }

    if (active.length > 0 && Number(active[0]!.min_distance_km) > 0) {
      problems.push('Aucune zone ne couvre les distances inférieures à ' + active[0]!.min_distance_km + ' km.');
    }

    return problems;
  }, [list]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Zones de livraison"
        description={
          restaurant
            ? `Distances calculées depuis ${restaurant.address_line}, ${restaurant.city}.`
            : undefined
        }
        action={
          <Button
            onClick={() =>
              setEditing({
                restaurant_id: restaurantId,
                min_distance_km: list.length > 0 ? Number(list[list.length - 1]!.max_distance_km) : 0,
                max_distance_km: 3,
                fee_amount: 200,
                eta_minutes: 25,
                is_active: true,
              })
            }
          >
            <Plus size={16} weight="bold" />
            Nouvelle zone
          </Button>
        }
      />

      {issues.length > 0 ? (
        <div
          className="flex gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}
        >
          <Warning size={20} weight="fill" className="shrink-0" />
          <div>
            <p className="font-semibold">Vérifiez vos tranches</p>
            <ul className="mt-1 list-disc pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Card padded={false} className="px-5 pb-2 pt-4">
        {zones.isLoading ? (
          <TableSkeleton rows={3} />
        ) : zones.isError ? (
          <ErrorState onRetry={() => void zones.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Aucune zone définie"
            description="Sans zone active, aucune livraison n’est possible. Créez au moins une tranche."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Zone</Th>
                <Th align="right">Distance</Th>
                <Th align="right">Frais</Th>
                <Th align="right">Délai</Th>
                <Th align="right">Livraison offerte dès</Th>
                <Th>Active</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((zone) => (
                <tr key={zone.id}>
                  <Td>
                    <span className="font-medium">{zone.name}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular">
                      {zone.min_distance_km} – {zone.max_distance_km} km
                    </span>
                  </Td>

                  <Td align="right">
                    <span className="tabular font-semibold">{formatMoney(zone.fee_amount)}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular">{zone.eta_minutes} min</span>
                  </Td>

                  <Td align="right">
                    {zone.free_above ? (
                      <span className="tabular">{formatMoney(zone.free_above)}</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </Td>

                  <Td>
                    <Toggle
                      checked={zone.is_active}
                      onChange={(value) =>
                        saveZone.mutate({
                          id: zone.id,
                          restaurant_id: restaurantId,
                          name: zone.name,
                          is_active: value,
                        })
                      }
                      label={`Activation de ${zone.name}`}
                    />
                  </Td>

                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(zone)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Supprimer"
                        onClick={() => {
                          if (confirm(`Supprimer la zone « ${zone.name} » ?`)) {
                            deleteZone.mutate(zone.id);
                          }
                        }}
                      >
                        <Trash size={16} color="var(--color-danger)" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">
          La distance est calculée à vol d’oiseau puis multipliée par 1,35 pour approcher le trajet
          réel en ville. C’est suffisant pour tarifer des tranches de 3 km ; passer à un calcul
          d’itinéraire deviendra utile au-delà de 200 commandes par jour.
        </p>
        <div className="mt-3 flex gap-2">
          <Badge tone="info">Approximation assumée</Badge>
        </div>
      </Card>

      <ZoneModal zone={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ZoneModal({
  zone,
  onClose,
}: {
  zone: Partial<DeliveryZone> | null;
  onClose: () => void;
}) {
  const restaurantId = useRestaurantId();
  const saveZone = useSaveZone();
  const [form, setForm] = useState<Partial<DeliveryZone>>(zone ?? {});
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | undefined>(zone?.id);

  if (zone && zone.id !== lastId) {
    setLastId(zone.id);
    setForm(zone);
  }

  if (!zone) return null;

  const submit = async () => {
    const min = Number(form.min_distance_km ?? 0);
    const max = Number(form.max_distance_km ?? 0);

    if (!form.name?.trim()) {
      setError('Donnez un nom à la zone.');
      return;
    }
    if (max <= min) {
      setError('La distance maximale doit être supérieure à la distance minimale.');
      return;
    }

    setError(null);
    try {
      await saveZone.mutateAsync({
        ...form,
        id: form.id,
        restaurant_id: restaurantId,
        name: form.name.trim(),
        min_distance_km: min,
        max_distance_km: max,
      });
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'Modifier la zone' : 'Nouvelle zone'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saveZone.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nom de la zone" required>
            <input
              className={inputClass}
              value={form.name ?? ''}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Proche — 0 à 3 km"
            />
          </Field>
        </div>

        <Field label="Distance minimale (km)" required>
          <input
            className={inputClass}
            type="number"
            step="0.5"
            min="0"
            value={form.min_distance_km ?? 0}
            onChange={(event) =>
              setForm({ ...form, min_distance_km: Number(event.target.value) })
            }
          />
        </Field>

        <Field label="Distance maximale (km)" required>
          <input
            className={inputClass}
            type="number"
            step="0.5"
            min="0"
            value={form.max_distance_km ?? 3}
            onChange={(event) =>
              setForm({ ...form, max_distance_km: Number(event.target.value) })
            }
          />
        </Field>

        <Field label="Frais de livraison ($)" required>
          <input
            className={inputClass}
            type="number"
            step="0.01"
            min="0"
            value={form.fee_amount != null ? form.fee_amount / 100 : ''}
            onChange={(event) =>
              setForm({ ...form, fee_amount: Math.round(Number(event.target.value || 0) * 100) })
            }
          />
        </Field>

        <Field label="Délai estimé (min)" required hint="Hors temps de préparation en cuisine.">
          <input
            className={inputClass}
            type="number"
            min="1"
            value={form.eta_minutes ?? 25}
            onChange={(event) => setForm({ ...form, eta_minutes: Number(event.target.value) })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Livraison offerte à partir de ($)"
            hint="Laisser vide pour toujours facturer la livraison."
          >
            <input
              className={inputClass}
              type="number"
              step="0.01"
              min="0"
              value={form.free_above != null ? form.free_above / 100 : ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  free_above: event.target.value
                    ? Math.round(Number(event.target.value) * 100)
                    : null,
                })
              }
            />
          </Field>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
