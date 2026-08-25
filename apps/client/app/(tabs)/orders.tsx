import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Receipt } from 'phosphor-react-native';
import {
  formatDateTime,
  formatMoney,
  isOrderTerminal,
  orderStatusCustomerLabel,
  orderStatusTone,
  useMyOrders,
  useSession,
} from '@istanbul/core';
import type { OrderDetail } from '@istanbul/types';
import {
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  FilterTabs,
  Header,
  ListSkeleton,
  Pressable,
  Screen,
  Spacer,
  Surface,
  Text,
  useTheme,
  useToast,
} from '@istanbul/ui';
import { AuthGate } from '@/components/AuthGate';
import { refillCartFromOrder } from '@/lib/reorder';
import { useCartBarListPadding } from '@/lib/layout';

type Filter = 'active' | 'past';

/**
 * Historique des commandes.
 *
 * « Commander à nouveau » recharge les lignes dans le panier depuis
 * l'instantané de la commande — sans refetch produit — puis ouvre le panier
 * où le client revalide avant le checkout ; le serveur revérifie chaque prix.
 */
export default function Orders() {
  const theme = useTheme();
  // Pas de barre de panier sur cet onglet, mais la barre d'onglets flotte :
  // la réserve reste obligatoire.
  const listBottomPadding = useCartBarListPadding(false);
  const { session, isLoading: sessionLoading } = useSession();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyOrders();
  const [filter, setFilter] = useState<Filter>('active');

  const filtered = useMemo(() => {
    const all = orders ?? [];
    return filter === 'active'
      ? all.filter((order) => !isOrderTerminal(order.status))
      : all.filter((order) => isOrderTerminal(order.status));
  }, [orders, filter]);

  const counts = useMemo(() => {
    const all = orders ?? [];
    return {
      active: all.filter((order) => !isOrderTerminal(order.status)).length,
      past: all.filter((order) => isOrderTerminal(order.status)).length,
    };
  }, [orders]);

  if (sessionLoading || !session) {
    return (
      <AuthGate
        title="Mes commandes"
        description="Vos commandes et votre historique apparaîtront ici."
        icon={<Receipt size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
      />
    );
  }

  return (
    <Screen>
      <Header title="Mes commandes" large />

      <View style={{ paddingHorizontal: theme.screenPadding }}>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'En cours', count: counts.active },
            { value: 'past', label: 'Terminées', count: counts.past },
          ]}
        />
      </View>

      <Spacer size="base" />

      {isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={3} />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding,
            paddingBottom: listBottomPadding,
            gap: theme.spacing.md,
          }}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={
            <EmptyState
              title={filter === 'active' ? 'Aucune commande en cours' : 'Aucune commande passée'}
              description={
                filter === 'active'
                  ? 'Vos commandes en cours apparaîtront ici avec leur suivi en temps réel.'
                  : 'Vos commandes terminées seront archivées ici.'
              }
              actionLabel="Voir le menu"
              onAction={() => router.push('/(tabs)/menu')}
              icon={<Receipt size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
            />
          }
        />
      )}
    </Screen>
  );
}

function OrderCard({ order }: { order: OrderDetail }) {
  const theme = useTheme();

  const itemsSummary = order.items
    .map((item) => `${item.quantity}× ${item.product_name}`)
    .join(', ');

  return (
    <Pressable
      onPress={() => router.push(`/order/${order.id}`)}
      accessibilityLabel={`Commande ${order.order_number}, ${
        orderStatusCustomerLabel[order.status]
      }, ${formatMoney(order.total, order.currency)}. Voir le détail`}
    >
      <Surface padding="base" elevation={0} bordered>
        <View style={styles.rowBetween}>
          <Text variant="labelStrong" tabular color="textSecondary">
            {order.order_number}
          </Text>
          <Badge
            label={orderStatusCustomerLabel[order.status]}
            tone={orderStatusTone[order.status]}
            size="sm"
            dot
          />
        </View>

        <Text variant="body" numberOfLines={2} style={{ marginTop: theme.spacing.sm }}>
          {itemsSummary}
        </Text>

        <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
          {formatDateTime(order.created_at)}
        </Text>

        <Divider spacing="md" />

        <View style={styles.rowBetween}>
          <Text variant="priceSmall" tabular>
            {formatMoney(order.total, order.currency)}
          </Text>

          {isOrderTerminal(order.status) ? (
            <ReorderButton order={order} />
          ) : (
            <Text variant="labelStrong" color="primary" style={{ textDecorationLine: 'underline' }}>
              Suivre →
            </Text>
          )}
        </View>
      </Surface>
    </Pressable>
  );
}

/**
 * « Commander à nouveau ».
 *
 * Réinjecte les lignes de la commande dans le panier depuis l'instantané —
 * l'ancienne version montait une requête produit PAR carte de l'historique
 * juste pour ce bouton. Les options ne sont pas rejouées (elles ont pu
 * changer) : un toast l'explique, et le panier reste modifiable avant de
 * confirmer.
 */
function ReorderButton({ order }: { order: OrderDetail }) {
  const toast = useToast();

  const reorder = () => {
    const { added, hadOptions } = refillCartFromOrder(order);

    if (added === 0) {
      toast.info('Ces plats ne sont plus au menu. Découvrez la carte du jour.');
      router.push('/(tabs)/menu');
      return;
    }

    toast.success(
      hadOptions
        ? 'Panier rempli — vérifiez vos suppléments avant de commander.'
        : 'Panier rempli à partir de votre commande.',
    );
    router.push('/cart');
  };

  return (
    <Button label="Commander à nouveau" variant="ghost" size="sm" onPress={reorder} />
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
