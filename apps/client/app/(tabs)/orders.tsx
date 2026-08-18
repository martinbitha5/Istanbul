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
  useProduct,
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
} from '@istanbul/ui';

type Filter = 'active' | 'past';

/**
 * Historique des commandes.
 *
 * « Commander à nouveau » recharge les lignes dans le panier depuis
 * l'instantané de la commande : on ne dépend pas du fait que les produits
 * existent encore au même prix, on repasse par la fiche produit à jour.
 */
export default function Orders() {
  const theme = useTheme();
  const { session } = useSession();
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

  if (!session) {
    return (
      <Screen>
        <Header title="Mes commandes" large />
        <EmptyState
          title="Connectez-vous"
          description="Vos commandes et votre historique apparaîtront ici."
          actionLabel="Se connecter"
          onAction={() => router.push('/(auth)/sign-in')}
          icon={<Receipt size={32} color={theme.colors.textMuted} weight="duotone" />}
        />
      </Screen>
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
            paddingBottom: theme.spacing.xl,
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
              icon={<Receipt size={32} color={theme.colors.textMuted} weight="duotone" />}
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
    <Pressable onPress={() => router.push(`/order/${order.id}`)}>
      <Surface padding="base" elevation={1}>
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
            <Text variant="labelStrong" color="primary">
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
 * On ne réinjecte pas l'instantané tel quel : on renvoie vers le menu avec
 * les produits d'origine mis en avant. Un produit supprimé ou dont les
 * options ont changé ne doit pas atterrir silencieusement dans le panier avec
 * un prix périmé.
 */
function ReorderButton({ order }: { order: OrderDetail }) {
  const firstProductId = order.items.find((item) => item.product_id)?.product_id ?? null;
  const { data: product } = useProduct(firstProductId);

  const reorder = () => {
    if (product) {
      // Les options d'origine ne sont pas rejouées automatiquement : on ouvre
      // la fiche pour que le client revalide ses choix aux conditions du jour.
      router.push(`/product/${product.id}`);
      return;
    }
    router.push('/(tabs)/menu');
  };

  return (
    <Button label="Commander à nouveau" variant="ghost" size="sm" onPress={reorder} />
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
