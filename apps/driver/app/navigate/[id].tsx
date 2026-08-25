import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationArrow, Storefront, User } from 'phosphor-react-native';
import {
  deliveryStatusLabel,
  deliveryStatusTone,
  roadDistanceKm,
  roughEtaMinutes,
  useDelivery,
  useDriverLocation,
  useDriverLocationRealtime,
  useDriverTrail,
} from '@istanbul/core';
import {
  Badge,
  Button,
  ErrorState,
  Header,
  Screen,
  Skeleton,
  Surface,
  Text,
  TrackingMap,
  useTheme,
} from '@istanbul/ui';
import type { MapRouteInfo } from '@istanbul/map';
import { RESTAURANT } from '@/lib/restaurant';

/**
 * Vue navigation du livreur.
 *
 * La seule vue inclinée du projet : caméra à 55°, orientée dans le sens de la
 * marche et verrouillée sur le livreur. Le client et le gérant veulent savoir
 * *où en est* la commande — une vue de dessus suffit. Le livreur, lui, veut
 * savoir *où tourner* ; c'est une question différente, et elle demande une
 * carte différente.
 *
 * Le guidage vocal reste chez Google Maps / Plans : le bouton du bas y passe
 * la main. Écrire un guidage tour par tour serait refaire un métier entier
 * pour une flotte de trois scooters.
 */
export default function NavigateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: delivery, isLoading, isError, refetch } = useDelivery(id ?? null);
  const [route, setRoute] = useState<MapRouteInfo | null>(null);

  const live = Boolean(delivery && delivery.status !== 'DELIVERED');
  const { data: myLocation } = useDriverLocation(id ?? null, live);
  const { data: trail } = useDriverTrail(id ?? null, Boolean(delivery));
  useDriverLocationRealtime(live ? (id ?? null) : null);

  if (isLoading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header title="Navigation" onBack={() => router.back()} />
        <View style={{ flex: 1, padding: theme.screenPadding }}>
          <Skeleton height={420} radius={theme.radius.lg} />
        </View>
      </Screen>
    );
  }

  if (isError || !delivery) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header title="Navigation" onBack={() => router.back()} />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const order = delivery.order;
  const pickupPhase = ['ACCEPTED', 'HEADING_TO_RESTAURANT'].includes(delivery.status);

  const destination =
    order.delivery_latitude != null && order.delivery_longitude != null
      ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
      : null;

  // La cible réelle du moment : la cuisine avant le retrait, le client après.
  const target = pickupPhase ? RESTAURANT.coords : destination;
  const targetName = pickupPhase ? RESTAURANT.name : 'Client';
  const targetAddress = pickupPhase
    ? RESTAURANT.address
    : (order.delivery_address ?? 'Adresse de livraison');

  // Repli tant que la carte n'a pas rendu son itinéraire (premier chargement,
  // réseau lent) : mieux vaut une estimation grossière qu'un tiret.
  const fallbackKm =
    myLocation && target
      ? roadDistanceKm(
          { latitude: myLocation.latitude, longitude: myLocation.longitude },
          target,
        )
      : null;

  const openExternalNavigation = () => {
    if (!target) {
      Alert.alert('Destination inconnue', "Cette commande n'a pas de coordonnées GPS.");
      return;
    }
    const url = Platform.select({
      ios: `maps://app?daddr=${target.latitude},${target.longitude}&dirflg=d`,
      android: `google.navigation:q=${target.latitude},${target.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`,
    });
    Linking.openURL(url!).catch(() => {
      Alert.alert('Navigation indisponible', `Destination : ${targetAddress}`);
    });
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header
        title={order.order_number}
        subtitle={pickupPhase ? 'Vers le restaurant' : 'Vers le client'}
        onBack={() => router.back()}
        right={
          <Badge
            label={deliveryStatusLabel[delivery.status]}
            tone={deliveryStatusTone[delivery.status]}
            size="sm"
          />
        }
      />

      <View style={{ flex: 1 }}>
        <TrackingMap
          restaurant={RESTAURANT.coords}
          destination={destination}
          driver={
            myLocation
              ? { latitude: myLocation.latitude, longitude: myLocation.longitude }
              : null
          }
          trail={trail ?? undefined}
          labels={{ restaurant: RESTAURANT.name, driver: 'Vous' }}
          showRoute
          routeTo={pickupPhase ? 'restaurant' : 'destination'}
          navigation
          interactive
          onRoute={setRoute}
          fill
        />

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
          <View style={styles.row}>
            {pickupPhase ? (
              <Storefront size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
            ) : (
              <User size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
            )}
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text variant="labelStrong" numberOfLines={1}>
                {targetName}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {targetAddress}
              </Text>
            </View>
          </View>

          <View style={[styles.row, { marginTop: theme.spacing.md }]}>
            {route ? (
              <Text variant="h3" tabular>
                {route.durationMin} min · {route.distanceKm.toLocaleString('fr-FR')} km
              </Text>
            ) : fallbackKm != null ? (
              <Text variant="h3" tabular>
                ~{roughEtaMinutes(fallbackKm)} min · {fallbackKm.toLocaleString('fr-FR')} km
              </Text>
            ) : (
              <Text variant="label" color="textMuted">
                En attente du signal GPS…
              </Text>
            )}
          </View>

          <Button
            label="Guidage vocal"
            onPress={openExternalNavigation}
            variant="secondary"
            fullWidth
            style={{ marginTop: theme.spacing.md }}
            icon={
              <NavigationArrow size={theme.iconSize.sm} color={theme.colors.text} weight="fill" />
            }
          />
        </Surface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
