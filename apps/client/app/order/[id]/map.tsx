import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Storefront, User } from 'phosphor-react-native';
import {
  deliveryStatusLabel,
  deliveryStatusTone,
  roadDistanceKm,
  roughEtaMinutes,
  useDriverLocation,
  useDriverLocationRealtime,
  useDriverTrail,
  useOrder,
  useOrderRealtime,
  useRestaurant,
} from '@istanbul/core';
import {
  Badge,
  ErrorState,
  Header,
  Screen,
  Skeleton,
  Surface,
  Text,
  TrackingMap,
  useTheme,
} from '@istanbul/ui';
import { useRestaurantId } from '@/store/restaurant';

/**
 * Carte plein écran.
 *
 * La vraie carte : gestes libres, itinéraire routier calculé (OSRM),
 * trace GPS réellement parcourue par le livreur, position vivante.
 * La vignette de l'écran de suivi n'est qu'un aperçu de celle-ci.
 */
export default function OrderMap() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = useOrder(id ?? null);
  const order = orderQuery.data;
  useOrderRealtime(id ?? null);

  const delivery = order?.delivery ?? null;
  const live = Boolean(delivery && !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(delivery.status));

  const restaurantId = useRestaurantId();
  const restaurantQuery = useRestaurant(restaurantId);
  const restaurant = restaurantQuery.data;
  const { data: driverLocation } = useDriverLocation(delivery?.id ?? null, live);
  const { data: trail } = useDriverTrail(delivery?.id ?? null, Boolean(delivery));
  useDriverLocationRealtime(live ? (delivery?.id ?? null) : null);

  const isLoading = orderQuery.isLoading || restaurantQuery.isLoading;
  const isError = orderQuery.isError || restaurantQuery.isError;

  // La branche erreur DOIT exister : `isLoading || !order` seul laissait un
  // squelette infini quand la requête échouait (réseau coupé en route).
  if (isError || (!isLoading && (!order || !restaurant))) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header title="Carte" onBack={() => router.back()} />
        <ErrorState
          onRetry={() => {
            void orderQuery.refetch();
            void restaurantQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  if (isLoading || !order || !restaurant) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header title="Carte" onBack={() => router.back()} />
        <View style={{ flex: 1, padding: theme.screenPadding }}>
          <Skeleton height={420} radius={theme.radius.lg} />
        </View>
      </Screen>
    );
  }

  const destination =
    order.delivery_latitude != null && order.delivery_longitude != null
      ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
      : null;

  const driver = driverLocation
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const remainingKm =
    driver && destination ? roadDistanceKm(driver, destination) : null;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header
        title="Suivi sur la carte"
        subtitle={order.order_number}
        onBack={() => router.back()}
        right={
          delivery ? (
            <Badge
              label={deliveryStatusLabel[delivery.status]}
              tone={deliveryStatusTone[delivery.status]}
              size="sm"
            />
          ) : undefined
        }
      />

      <View style={{ flex: 1 }}>
        <TrackingMap
          restaurant={{ latitude: restaurant.latitude, longitude: restaurant.longitude }}
          destination={destination}
          driver={driver}
          trail={trail ?? undefined}
          showRoute
          interactive
          fill
        />

        {/* --- Cartouche d'état par-dessus la carte ---------------------- */}
        <Surface
          padding="base"
          elevation={3}
          style={[
            styles.overlay,
            {
              left: theme.screenPadding,
              right: theme.screenPadding,
              bottom: Math.max(insets.bottom, theme.spacing.base),
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <View style={styles.legendRow}>
            <Storefront size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
            <Text variant="bodySmall" style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              {restaurant.name}
            </Text>
          </View>

          <View style={[styles.legendRow, { marginTop: theme.spacing.sm }]}>
            <User size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
            <Text
              variant="bodySmall"
              color="textSecondary"
              numberOfLines={1}
              style={{ flex: 1, marginLeft: theme.spacing.sm }}
            >
              {order.delivery_address ?? 'Adresse de livraison'}
            </Text>
          </View>

          <View style={[styles.legendRow, { marginTop: theme.spacing.md }]}>
            {remainingKm != null ? (
              <Text variant="labelStrong" tabular>
                🛵 à ~{remainingKm.toLocaleString('fr-FR')} km · {roughEtaMinutes(remainingKm)} min
              </Text>
            ) : (
              <Text variant="label" color="textMuted">
                {live ? 'En attente de la position du livreur…' : 'Course terminée'}
              </Text>
            )}
          </View>

          <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
            Trait plein : chemin parcouru · pointillés : itinéraire conseillé
          </Text>
        </Surface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
});
