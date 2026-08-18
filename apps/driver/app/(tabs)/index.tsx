import { useCallback } from 'react';
import { FlatList, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MapPin, Package, Timer } from 'phosphor-react-native';
import {
  deliveryStatusLabel,
  deliveryStatusTone,
  formatMoney,
  formatRelative,
  useActiveDeliveries,
  useAvailableDeliveries,
  useClaimDelivery,
  useDriverEarnings,
  useDriverProfile,
  useDriverRealtime,
  useSetAvailability,
} from '@istanbul/core';
import type { DeliveryWithOrder } from '@istanbul/core';
import {
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  Pressable,
  Screen,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { useLocationTracking } from '@/hooks/useLocationTracking';

/**
 * Tableau de bord du livreur.
 *
 * Priorité absolue à la course en cours : elle occupe le haut de l'écran et
 * ne demande jamais de défiler. Les courses disponibles viennent ensuite.
 */
export default function DriverHome() {
  const theme = useTheme();

  const { data: driver, isLoading: driverLoading } = useDriverProfile();
  const driverId = driver?.id ?? null;

  const active = useActiveDeliveries(driverId);
  const available = useAvailableDeliveries(driver?.availability === 'AVAILABLE');
  const { data: earnings } = useDriverEarnings(driverId);
  const claimDelivery = useClaimDelivery();

  useDriverRealtime(driverId, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  const currentDelivery = active.data?.[0] ?? null;

  // La position ne remonte que pendant une course active.
  useLocationTracking(currentDelivery?.id ?? null, Boolean(currentDelivery));

  // Mutation optimiste : l'interrupteur bascule immédiatement, sans attendre
  // l'aller-retour réseau — et se remet en place tout seul en cas d'échec.
  const setAvailability = useSetAvailability();

  const toggleOnline = useCallback(
    (online: boolean) => {
      if (!driverId) return;
      void Haptics.selectionAsync();
      setAvailability.mutate({ driverId, availability: online ? 'AVAILABLE' : 'OFFLINE' });
    },
    [driverId, setAvailability],
  );

  if (driverLoading) {
    return (
      <Screen>
        <Header title="Mes courses" large />
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={2} />
        </View>
      </Screen>
    );
  }

  const isOnline = driver?.availability !== 'OFFLINE';

  return (
    <Screen>
      <Header
        title="Mes courses"
        large
        right={
          <View style={styles.onlineToggle}>
            <Text variant="label" color={isOnline ? 'success' : 'textMuted'}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={(value) => void toggleOnline(value)}
              trackColor={{ true: theme.colors.success, false: theme.colors.border }}
              accessibilityLabel="Disponibilité"
              style={{ marginLeft: 8 }}
            />
          </View>
        }
      />

      <FlatList<DeliveryWithOrder>
        data={isOnline ? (available.data ?? []) : []}
        keyExtractor={(item) => item.id}
        refreshing={available.isRefetching}
        onRefresh={() => {
          void available.refetch();
          void active.refetch();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.screenPadding,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
        ListHeaderComponent={
          <View>
            {/* --- Revenus du jour --------------------------------------- */}
            <Surface padding="base" elevation={1}>
              <View style={styles.rowBetween}>
                <View>
                  <Text variant="caption" color="textMuted">
                    Gains aujourd’hui
                  </Text>
                  <Text variant="display" tabular color="primary" style={{ marginTop: 2 }}>
                    {formatMoney(earnings?.today ?? 0)}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="caption" color="textMuted">
                    Livraisons
                  </Text>
                  <Text variant="h1" tabular>
                    {earnings?.deliveriesToday ?? 0}
                  </Text>
                </View>
              </View>
            </Surface>

            {/* --- Course en cours --------------------------------------- */}
            {currentDelivery ? (
              <>
                <Spacer size="xl" />
                <Text variant="h2">Course en cours</Text>
                <Spacer size="md" />
                <ActiveDeliveryCard delivery={currentDelivery} />
              </>
            ) : null}

            {/* --- Titre section disponible ------------------------------ */}
            <Spacer size="xl" />
            <Text variant="h2">Courses disponibles</Text>
            <Spacer size="md" />

            {!isOnline ? (
              <Surface padding="base" elevation={0} style={{ backgroundColor: theme.colors.surfaceSunken }}>
                <Text variant="body" color="textSecondary" align="center">
                  Vous êtes hors ligne. Activez votre disponibilité pour recevoir des courses.
                </Text>
              </Surface>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isOnline ? (
            available.isLoading ? (
              <ListSkeleton count={2} />
            ) : available.isError ? (
              <ErrorState onRetry={() => void available.refetch()} />
            ) : (
              <EmptyState
                title="Aucune course pour le moment"
                description="Restez en ligne : vous serez notifié dès qu’une commande est prête."
                icon={<Package size={32} color={theme.colors.textMuted} weight="duotone" />}
              />
            )
          ) : null
        }
        renderItem={({ item }) => (
          <AvailableDeliveryCard
            delivery={item}
            onAccept={() => {
              if (!driverId) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              claimDelivery.mutate({ deliveryId: item.id, driverId });
            }}
            loading={claimDelivery.isPending}
          />
        )}
      />
    </Screen>
  );
}

function ActiveDeliveryCard({ delivery }: { delivery: DeliveryWithOrder }) {
  const theme = useTheme();
  const order = delivery.order;

  return (
    <Pressable onPress={() => router.push(`/delivery/${delivery.id}`)}>
      <Surface padding="base" elevation={2} style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}>
        <View style={styles.rowBetween}>
          <Text variant="labelStrong" tabular color="textSecondary">
            {order.order_number}
          </Text>
          <Badge
            label={deliveryStatusLabel[delivery.status]}
            tone={deliveryStatusTone[delivery.status]}
            size="sm"
            dot
          />
        </View>

        <Text variant="h3" style={{ marginTop: theme.spacing.sm }}>
          {order.contact_name}
        </Text>

        <View style={[styles.metaRow, { marginTop: theme.spacing.xs }]}>
          <MapPin size={14} color={theme.colors.textMuted} />
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1} style={{ marginLeft: 4, flex: 1 }}>
            {order.delivery_address}
            {order.delivery_commune ? `, ${order.delivery_commune}` : ''}
          </Text>
        </View>

        <Divider spacing="md" />

        <View style={styles.rowBetween}>
          <View>
            <Text variant="caption" color="textMuted">
              À encaisser
            </Text>
            <Text variant="priceSmall" tabular>
              {formatMoney(delivery.cash_to_collect, order.currency)}
            </Text>
          </View>

          <Button label="Continuer" size="sm" onPress={() => router.push(`/delivery/${delivery.id}`)} />
        </View>
      </Surface>
    </Pressable>
  );
}

function AvailableDeliveryCard({
  delivery,
  onAccept,
  loading,
}: {
  delivery: DeliveryWithOrder;
  onAccept: () => void;
  loading: boolean;
}) {
  const theme = useTheme();
  const order = delivery.order;

  return (
    <Surface padding="base" elevation={1}>
      <View style={styles.rowBetween}>
        <Text variant="labelStrong" tabular color="textSecondary">
          {order.order_number}
        </Text>
        <View style={styles.metaRow}>
          <Timer size={13} color={theme.colors.textMuted} />
          <Text variant="caption" color="textMuted" style={{ marginLeft: 3 }}>
            {formatRelative(delivery.offered_at)}
          </Text>
        </View>
      </View>

      <View style={[styles.metaRow, { marginTop: theme.spacing.sm }]}>
        <MapPin size={16} color={theme.colors.primary} weight="fill" />
        <Text variant="bodyStrong" numberOfLines={2} style={{ marginLeft: 6, flex: 1 }}>
          {order.delivery_commune ?? order.delivery_address}
        </Text>
      </View>

      <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
        {order.items.length} article{order.items.length > 1 ? 's' : ''}
        {delivery.distance_km ? ` · ${delivery.distance_km} km` : ''}
      </Text>

      <Divider spacing="md" />

      <View style={styles.rowBetween}>
        <View>
          <Text variant="caption" color="textMuted">
            Votre gain
          </Text>
          <Text variant="priceSmall" tabular color="success">
            {formatMoney(delivery.payout_amount, order.currency)}
          </Text>
        </View>

        <Button label="Accepter" onPress={onAccept} loading={loading} size="sm" />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  onlineToggle: { flexDirection: 'row', alignItems: 'center' },
});
