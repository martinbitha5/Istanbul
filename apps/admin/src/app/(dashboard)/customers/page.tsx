'use client';

import { useMemo, useState } from 'react';
import { formatMoney, formatPhone, formatRelative, useAdminCustomers } from '@istanbul/core';
import type { CustomerRow } from '@istanbul/core';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  SortableTh,
  Table,
  TableSkeleton,
  Td,
  Th,
  inputClass,
  useSort,
} from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { useRestaurantId } from '@/hooks/useRestaurantId';

type SortKey = 'full_name' | 'orders_count' | 'total_spent' | 'last_order_at';

/**
 * Clients.
 *
 * Triés par montant dépensé : le gérant veut identifier ses habitués avant
 * tout. La recherche est locale — la liste est déjà chargée en entier.
 */
export default function CustomersPage() {
  const restaurantId = useRestaurantId();
  const customers = useAdminCustomers(restaurantId);
  const [search, setSearch] = useState('');

  // Par défaut : les plus gros clients en tête. C'est la question que le
  // gérant se pose en ouvrant la page ; le tri lui laisse en poser d'autres
  // (« qui n'est pas revenu depuis un mois ? »).
  const { state: sortState, onSort, sort } = useSort<CustomerRow, SortKey>(
    { key: 'total_spent', direction: 'desc' },
    (customer, key) => customer[key],
  );

  const filtered = useMemo(() => {
    const all = customers.data ?? [];
    const term = search.trim().toLowerCase();
    const matched = term
      ? all.filter(
          (customer) =>
            customer.full_name.toLowerCase().includes(term) ||
            customer.phone?.includes(term) ||
            customer.email?.toLowerCase().includes(term),
        )
      : all;

    return sort(matched);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sort` dépend de sortState
  }, [customers.data, search, sortState]);

  const totalRevenue = useMemo(
    () => (customers.data ?? []).reduce((sum, customer) => sum + customer.total_spent, 0),
    [customers.data],
  );

  // « Habitué » désigne les trois plus gros clients, pas les trois premières
  // lignes : depuis que la colonne est triable, la position dans le tableau
  // ne veut plus rien dire.
  const regulars = useMemo(() => {
    const top = [...(customers.data ?? [])]
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 3)
      .filter((customer) => customer.total_spent > 0);
    return new Set(top.map((customer) => customer.id));
  }, [customers.data]);

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        title="Clients"
        description={`${customers.data?.length ?? 0} clients · ${formatMoney(totalRevenue)} de chiffre d’affaires cumulé`}
        action={
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, téléphone, email…"
            className={`${inputClass} sm:w-72`}
            aria-label="Rechercher un client"
          />
        }
      />

      <Card padded={false} className="px-5 pb-2 pt-4">
        {customers.isLoading ? (
          <TableSkeleton rows={6} />
        ) : customers.isError ? (
          <ErrorState onRetry={() => void customers.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? 'Aucun résultat' : 'Aucun client'}
            description={
              search
                ? 'Essayez un autre nom ou numéro.'
                : 'Les clients apparaîtront ici dès leur première commande.'
            }
          />
        ) : (
          <Table ariaLabel="Liste des clients">
            <thead>
              <tr>
                <SortableTh sortKey="full_name" state={sortState} onSort={onSort}>
                  Client
                </SortableTh>
                <Th>Contact</Th>
                <SortableTh sortKey="orders_count" state={sortState} onSort={onSort} align="right">
                  Commandes
                </SortableTh>
                <SortableTh sortKey="total_spent" state={sortState} onSort={onSort} align="right">
                  Total dépensé
                </SortableTh>
                <SortableTh sortKey="last_order_at" state={sortState} onSort={onSort}>
                  Dernière commande
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.full_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer.full_name || 'Sans nom'}</p>
                        {regulars.has(customer.id) ? <Badge tone="warning">Habitué</Badge> : null}
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <p className="tabular text-sm">{formatPhone(customer.phone)}</p>
                    {customer.email ? (
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {customer.email}
                      </p>
                    ) : null}
                  </Td>

                  <Td align="right">
                    <span className="tabular">{customer.orders_count}</span>
                  </Td>

                  <Td align="right">
                    <span className="tabular font-semibold">
                      {formatMoney(customer.total_spent)}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatRelative(customer.last_order_at)}
                    </span>
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
