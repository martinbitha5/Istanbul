import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
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
  SectionHeader,
  Spacer,
  Surface,
  Text,
  useTheme,
  useToast,
} from '@istanbul/ui';
import { Row } from '@/components/Row';
import { useLocationTracking } from '@/hooks/useLocationTracking';

/**
 * Tableau de bord du livreur.
 *
 * Priorité absolue à la course en cours : elle occupe le haut de l'écran et
 * ne demande jamais de défiler. Les courses disponibles viennent ensuite.
 */
export default function DriverHome() {
  const theme = useTheme();
  const toast = useToast();

  const { data: driver, isLoading: driverLoading } = useDriverProfile();
  const driverId = driver?.id ?? null;

  const active = useActiveDeliveries(driverId);
  const available = useAvailableDeliveries(driver?.availability === 'AVAILABLE');
  const earnings = useDriverEarnings(driverId);
  const claimDelivery = useClaimDelivery();

  // Une seule carte à la fois montre son spinner : `isPending` global
  // mettait TOUTES les cartes en chargement dès qu'on en acceptait une.
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Mémorise les courses déjà affichées : l'animation d'entrée ne doit jouer
  // qu'à l'apparition réelle d'une carte, pas à chaque recyclage de la liste.
  const seenIds = useRef(new Set<string>());

  useDriverRealtime(driverId, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  const currentDelivery = active.data?.[0] ?? null;

  // La position ne remonte que pendant une course active.
  useLocationTracking(currentDelivery?.id ?? null, Boolean(currentDelivery));

  // Mutation optimiste : l'interrupteur bascule immédiatement, sans attendre
  // l'aller-retour réseau — et se remet en place tout seul en cas d'échec
  // (le toast global affiche alors l'erreur, le rollback n'est plus muet).
  const setAvailability = useSetAvailability();

  const toggleOnline = useCallback(
    (online: boolean) => {
      if (!driverId) return;
      void Haptics.selectionAsync();
      setAvailability.mutate({ driverId, availability: online ? 'AVAILABLE' : 'OFFLINE' });
    },
    [driverId, setAvailability],
  );

  const acceptDelivery = useCallback(
    (deliveryId: string) => {
      if (!driverId || claimingId) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setClaimingId(deliveryId);
      claimDelivery.mutate(
        { deliveryId, driverId },
        {
          // Navigation directe : la carte migre de « disponibles » vers
          // « en cours », le livreur n'a plus à la chercher des yeux.
          onSuccess: () => {
            toast.success('Course acceptée');
            router.push(`/delivery/${deliveryId}`);
          },
          onSettled: () => setClaimingId(null),
        },
      );
    },
    [driverId, claimingId, claimDelivery, toast],
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
            {/* « Disponible », pas « En ligne » : le bandeau réseau utilise
                déjà « hors ligne », deux sens différents pour les mêmes mots
                rendaient l'écran ambigu. */}
            <Text variant="label" color={isOnline ? 'success' : 'textMuted'}>
              {isOnline ? 'Disponible' : 'Indisponible'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={(value) => void toggleOnline(value)}
              trackColor={{ true: theme.colors.success, false: theme.colors.border }}
              accessibilityLabel="Disponibilité"
              accessibilityValue={{ text: isOnline ? 'Disponible' : 'Indisponible' }}
              accessibilityHint={
                isOnline
                  ? 'Vous ne recevrez plus de nouvelles courses'
                  : 'Vous recevrez de nouvelles courses'
              }
              style={{ marginLeft: theme.spacing.sm }}
            />
          </View>
        }
      />

      <Animated.FlatList<DeliveryWithOrder>
        data={isOnline ? (available.data ?? []) : []}
        keyExtractor={(item) => item.id}
        // Une nouvelle course qui surgit d'un coup décale la liste et fait
        // taper le livreur sur la mauvaise ligne : la transition adoucit ça.
        itemLayoutAnimation={LinearTransition.duration(theme.duration.base)}
        refreshing={available.isRefetching}
        onRefresh={() => {
          void available.refetch();
          void active.refetch();
          void earnings.refetch();
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
              <Row>
                <View>
                  <Text variant="caption" color="textMuted">
                    Gains aujourd’hui
                  </Text>
                  <Text
                    variant="display"
                    tabular
                    color="primary"
                    style={{ marginTop: theme.spacing.xxs }}
                  >
                    {formatMoney(earnings.data?.today ?? 0)}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="caption" color="textMuted">
                    Livraisons
                  </Text>
                  <Text variant="h1" tabular>
                    {earnings.data?.deliveriesToday ?? 0}
                  </Text>
                </View>
              </Row>
            </Surface>

            {/* --- Course en cours --------------------------------------- */}
            {currentDelivery ? (
              <>
                <Spacer size="xl" />
                <SectionHeader title="Course en cours" />
                <ActiveDeliveryCard delivery={currentDelivery} />
              </>
            ) : null}

            {/* --- Titre section disponible ------------------------------ */}
            <Spacer size="xl" />
            <SectionHeader title="Courses disponibles" />

            {!isOnline ? (
              <Surface
                padding="base"
                elevation={0}
                style={{ backgroundColor: theme.colors.surfaceSunken }}
              >
                <Text variant="body" color="textSecondary" align="center">
                  Vous êtes indisponible. Activez votre disponibilité pour recevoir des courses.
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
                description="Restez disponible : vous serez notifié dès qu’une commande est prête."
                icon={
                  <Package size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />
                }
              />
            )
          ) : null
        }
        renderItem={({ item, index }) => {
          const isNew = !seenIds.current.has(item.id);
          if (isNew) seenIds.current.add(item.id);
          return (
            <Animated.View
              entering={
                isNew
                  ? FadeInDown.duration(theme.duration.base).delay(theme.stagger.delayFor(index))
                  : undefined
              }
            >
              <AvailableDeliveryCard
                delivery={item}
                onAccept={() => acceptDelivery(item.id)}
                loading={claimingId === item.id}
                disabled={claimingId !== null && claimingId !== item.id}
              />
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

function ActiveDeliveryCard({ delivery }: { delivery: DeliveryWithOrder }) {
  const theme = useTheme();
  const order = delivery.order;

  return (
    <Pressable onPress={() => router.push(`/delivery/${delivery.id}`)}>
      <Surface
        padding="base"
        elevation={2}
        style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}
      >
        <Row>
          <Text variant="labelStrong" tabular color="textSecondary">
            {order.order_number}
          </Text>
          <Badge
            label={deliveryStatusLabel[delivery.status]}
            tone={deliveryStatusTone[delivery.status]}
            size="sm"
            dot
          />
        </Row>

        <Text variant="h3" style={{ marginTop: theme.spacing.sm }}>
          {order.contact_name}
        </Text>

        <View style={[styles.metaRow, { marginTop: theme.spacing.xs }]}>
          <MapPin size={theme.iconSize.xs} color={theme.colors.textMuted} />
          <Text
            variant="bodySmall"
            color="textSecondary"
            numberOfLines={1}
            style={{ marginLeft: theme.spacing.xs, flex: 1 }}
          >
            {order.delivery_address}
            {order.delivery_commune ? `, ${order.delivery_commune}` : ''}
          </Text>
        </View>

        <Divider spacing="md" />

        <Row>
          <View>
            <Text variant="caption" color="textMuted">
              À encaisser
            </Text>
            <Text variant="priceSmall" tabular>
              {formatMoney(delivery.cash_to_collect, order.currency)}
            </Text>
          </View>

          <Button label="Continuer" size="sm" onPress={() => router.push(`/delivery/${delivery.id}`)} />
        </Row>
      </Surface>
    </Pressable>
  );
}

function AvailableDeliveryCard({
  delivery,
  onAccept,
  loading,
  disabled,
}: {
  delivery: DeliveryWithOrder;
  onAccept: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const theme = useTheme();
  const order = delivery.order;

  return (
    <Surface padding="base" elevation={1}>
      <Row>
        <Text variant="labelStrong" tabular color="textSecondary">
          {order.order_number}
        </Text>
        <View style={styles.metaRow}>
          <Timer size={theme.iconSize.xs} color={theme.colors.textMuted} />
          <Text variant="caption" color="textMuted" style={{ marginLeft: theme.spacing.xs }}>
            {formatRelative(delivery.offered_at)}
          </Text>
        </View>
      </Row>

      <View style={[styles.metaRow, { marginTop: theme.spacing.sm }]}>
        <MapPin size={theme.iconSize.xs} color={theme.colors.primary} weight="fill" />
        <Text variant="bodyStrong" numberOfLines={2} style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
          {order.delivery_commune ?? order.delivery_address}
        </Text>
      </View>

      <Text variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.xxs }}>
        {order.items.length} article{order.items.length > 1 ? 's' : ''}
        {delivery.distance_km ? ` · ${delivery.distance_km} km` : ''}
      </Text>

      <Divider spacing="md" />

      <Row>
        <View>
          <Text variant="caption" color="textMuted">
            Votre gain
          </Text>
          <Text variant="priceSmall" tabular color="success">
            {formatMoney(delivery.payout_amount, order.currency)}
          </Text>
        </View>

        <Button label="Accepter" onPress={onAccept} loading={loading} disabled={disabled} size="sm" />
      </Row>
    </Surface>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  onlineToggle: { flexDirection: 'row', alignItems: 'center' },
});
