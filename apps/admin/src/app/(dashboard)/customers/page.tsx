'use client';

import { useMemo, useState } from 'react';
import { formatMoney, formatPhone, formatRelative, initials, useAdminCustomers } from '@istanbul/core';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  Table,
  TableSkeleton,
  Td,
  Th,
  inputClass,
} from '@/components/ui';
import { useRestaurantId } from '@/hooks/useRestaurantId';

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

  const filtered = useMemo(() => {
    const all = customers.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;

    return all.filter(
      (customer) =>
        customer.full_name.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.email?.toLowerCase().includes(term),
    );
  }, [customers.data, search]);

  const totalRevenue = useMemo(
    () => (customers.data ?? []).reduce((sum, customer) => sum + customer.total_spent, 0),
    [customers.data],
  );

  return (
    <div className="space-y-6">
      <SectionTitle
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
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Contact</Th>
                <Th align="right">Commandes</Th>
                <Th align="right">Total dépensé</Th>
                <Th>Dernière commande</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, index) => (
                <tr key={customer.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          background: 'var(--color-primary-soft)',
                          color: 'var(--color-on-primary-soft)',
                        }}
                      >
                        {initials(customer.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer.full_name || 'Sans nom'}</p>
                        {/* Les trois premiers sont les meilleurs clients :
                            c'est l'information que le gérant cherche. */}
                        {index < 3 && !search ? <Badge tone="warning">Habitué</Badge> : null}
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
