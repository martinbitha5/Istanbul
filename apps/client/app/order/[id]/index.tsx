import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Phone, XCircle } from 'phosphor-react-native';
import {
  customerCanCancel,
  formatDateTime,
  formatEtaRange,
  formatMoney,
  formatPhone,
  formatTime,
  initials,
  orderStatusCustomerLabel,
  orderStatusTone,
  roadDistanceKm,
  roughEtaMinutes,
  summarizeOptions,
  toUserMessage,
  useCancelOrder,
  useConfirmationCode,
  useDriverLocation,
  useDriverLocationRealtime,
  useOrder,
  useOrderRealtime,
  useOrderReview,
  useRestaurant,
  useSubmitReview,
} from '@istanbul/core';
import type { OrderDetail, TrackingStep } from '@istanbul/types';
import {
  Avatar,
  Badge,
  Button,
  ConfirmationCode,
  Divider,
  ErrorState,
  Header,
  Input,
  OfflineBanner,
  OrderProgress,
  OrderTimeline,
  Pressable,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  StarRating,
  Surface,
  Text,
  TrackingMap,
  useTheme,
  useToast,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';
import { useIsOffline } from '@/providers/AppProviders';
import { refillCartFromOrder } from '@/lib/reorder';
import { goBack, useAndroidBack } from '@/lib/nav';

/**
 * Parent du suivi quand la pile est vide : on arrive ici depuis le checkout
 * (`dismissAll` + `replace`) ou depuis une notification, sans historique.
 * La liste des commandes est le parent naturel du détail d'une commande.
 */
const BACK_FALLBACK = '/(tabs)/orders' as const;

/**
 * Suivi de commande.
 *
 * Écran temps réel : `useOrderRealtime` invalide la requête à chaque
 * changement de statut, d'où une timeline qui avance toute seule sans que le
 * client ait à tirer pour rafraîchir.
 */
export default function OrderTracking() {
  const theme = useTheme();
  const toast = useToast();
  const offline = useIsOffline();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, refetch } = useOrder(id ?? null);
  useOrderRealtime(id ?? null);
  useAndroidBack(BACK_FALLBACK);

  const cancelOrder = useCancelOrder();

  // --- Carte temps réel ----------------------------------------------------
  // Active dès qu'un livreur a pris la course, jusqu'à la remise.
  const delivery = order?.delivery ?? null;
  const trackingActive = Boolean(
    order?.fulfillment === 'DELIVERY' &&
      delivery &&
      ['ACCEPTED', 'HEADING_TO_RESTAURANT', 'PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED'].includes(
        delivery.status,
      ),
  );
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: driverLocation } = useDriverLocation(delivery?.id ?? null, trackingActive);
  useDriverLocationRealtime(trackingActive ? (delivery?.id ?? null) : null);

  // Le code n'existe qu'une fois une livraison créée, et n'a plus d'intérêt
  // une fois la commande remise.
  const { data: confirmationCode } = useConfirmationCode(
    id ?? null,
    Boolean(order?.delivery) && order?.status !== 'DELIVERED' && order?.status !== 'CANCELLED',
  );

  const timestamps = useMemo<Partial<Record<TrackingStep, string | null>>>(() => {
    if (!order) return {};
    return {
      RECEIVED: order.created_at,
      PREPARING: order.accepted_at,
      READY: order.ready_at,
      ON_THE_WAY: order.picked_up_at,
      DELIVERED: order.delivered_at,
    };
  }, [order]);

  // Distance livreur → client : mémoïsée, l'IIFE d'origine recalculait la
  // distance routière à CHAQUE rendu (donc à chaque tick realtime de l'écran).
  const driverDistance = useMemo(() => {
    if (
      !driverLocation ||
      order?.delivery_latitude == null ||
      order?.delivery_longitude == null
    ) {
      return null;
    }
    const km = roadDistanceKm(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      { latitude: order.delivery_latitude, longitude: order.delivery_longitude },
    );
    return { km, etaMinutes: roughEtaMinutes(km) };
  }, [driverLocation, order?.delivery_latitude, order?.delivery_longitude]);

  const confirmCancel = () => {
    // L'annulation est définitive : jamais au premier tap.
    Alert.alert(
      'Annuler la commande ?',
      'Cette action est définitive. Vous pourrez repasser commande à tout moment.',
      [
        { text: 'Garder ma commande', style: 'cancel' },
        {
          text: 'Annuler la commande',
          style: 'destructive',
          onPress: () =>
            cancelOrder.mutate({ orderId: id ?? '', reason: 'Annulée par le client' }),
        },
      ],
    );
  };

  if (isLoading) return <TrackingSkeleton />;
  if (isError || !order) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header onBack={() => goBack(BACK_FALLBACK)} />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const driverProfile = order.delivery?.driver?.profile;
  const isCancelled = order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header
        title={order.order_number}
        subtitle={formatDateTime(order.created_at)}
        onBack={() => goBack(BACK_FALLBACK)}
      />

      {/* Écran temps réel : sans réseau, le suivi est gelé — il faut le dire. */}
      <OfflineBanner visible={offline} />

      <ScreenScroll>
        {/* --- Statut ------------------------------------------------------
            `accessibilityLiveRegion` : le statut change tout seul en realtime,
            les lecteurs d'écran doivent annoncer la progression. */}
        <Surface padding="lg" elevation={0} bordered accessibilityLiveRegion="polite">
          <View style={styles.rowBetween}>
            <Badge
              label={orderStatusCustomerLabel[order.status]}
              tone={orderStatusTone[order.status]}
              dot
            />
            {!isDelivered && !isCancelled && order.eta_minutes ? (
              <Text variant="labelStrong" color="textSecondary" tabular>
                {formatEtaRange(order.eta_minutes)}
              </Text>
            ) : null}
          </View>

          <Text variant="h1" style={{ marginTop: theme.spacing.md }}>
            {isCancelled
              ? 'Commande annulée'
              : isDelivered
                ? 'Bon appétit !'
                : order.fulfillment === 'PICKUP'
                  ? 'Votre commande est en préparation'
                  : 'Votre commande arrive'}
          </Text>

          {isCancelled && order.cancellation_reason ? (
            <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
              {order.cancellation_reason}
            </Text>
          ) : null}

          {/* Progression segmentée juste sous le titre : c'est le résumé qu'on
              lit en une seconde, avant de descendre dans le détail horodaté.
              Elle est masquée à l'annulation, où il n'y a plus de progression
              à montrer — cinq traits gris ne diraient rien. */}
          {!isCancelled ? (
            <OrderProgress status={order.status} style={{ marginTop: theme.spacing.lg }} />
          ) : null}

          <Divider spacing="lg" />

          <OrderTimeline status={order.status} timestamps={timestamps} formatTime={formatTime} />
        </Surface>

        {/* --- Carte temps réel ------------------------------------------ */}
        {trackingActive && restaurant ? (
          <>
            <Spacer size="lg" />
            <Surface padding="base" elevation={0} bordered>
              <TrackingMap
                restaurant={{ latitude: restaurant.latitude, longitude: restaurant.longitude }}
                destination={
                  order.delivery_latitude != null && order.delivery_longitude != null
                    ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
                    : null
                }
                driver={
                  driverLocation
                    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
                    : null
                }
                labels={{ restaurant: restaurant.name, driver: 'Votre livreur' }}
                // L'itinéraire dès la vignette : c'est ce qui distingue un
                // aperçu utile d'une image de carte avec deux épingles.
                showRoute
                followDriver
                onPress={() => router.push(`/order/${order.id}/map`)}
              />
              {driverDistance ? (
                <Text
                  variant="caption"
                  color="textSecondary"
                  align="center"
                  style={{ marginTop: theme.spacing.sm }}
                  tabular
                >
                  {`Livreur à ~${driverDistance.km.toLocaleString('fr-FR')} km · ${driverDistance.etaMinutes} min`}
                </Text>
              ) : (
                <Text
                  variant="caption"
                  color="textMuted"
                  align="center"
                  style={{ marginTop: theme.spacing.sm }}
                >
                  En attente de la position du livreur…
                </Text>
              )}
            </Surface>
          </>
        ) : null}

        {/* --- Code de confirmation -------------------------------------- */}
        {confirmationCode && !isDelivered && !isCancelled ? (
          <>
            <Spacer size="lg" />
            <Surface padding="lg" elevation={0} bordered>
              <ConfirmationCode
                code={confirmationCode}
                label="Code à communiquer au livreur"
              />
              <Text
                variant="caption"
                color="textMuted"
                align="center"
                style={{ marginTop: theme.spacing.md }}
              >
                Ne donnez ce code qu’au moment de recevoir votre commande.
              </Text>
            </Surface>
          </>
        ) : null}

        {/* --- Livreur ---------------------------------------------------- */}
        {driverProfile && !isDelivered ? (
          <>
            <Spacer size="lg" />
            <Surface padding="base" elevation={0} bordered>
              <View style={styles.driverRow}>
                <Avatar uri={driverProfile.avatar_url} fallback={initials(driverProfile.full_name)} />

                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text variant="caption" color="textMuted">
                    Votre livreur
                  </Text>
                  <Text variant="h3">{driverProfile.full_name}</Text>
                  {order.delivery?.distance_km ? (
                    <Text variant="caption" color="textSecondary" tabular>
                      {order.delivery.distance_km} km · {order.delivery.status === 'ARRIVED' ? 'Arrivé' : 'En route'}
                    </Text>
                  ) : null}
                </View>

                {driverProfile.phone ? (
                  <Pressable
                    onPress={() => void Linking.openURL(`tel:${driverProfile.phone}`)}
                    accessibilityLabel={`Appeler ${driverProfile.full_name}`}
                    style={[
                      styles.callButton,
                      { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
                    ]}
                  >
                    <Phone size={theme.iconSize.sm} color={theme.colors.textOnPrimary} weight="fill" />
                  </Pressable>
                ) : null}
              </View>
            </Surface>
          </>
        ) : null}

        {/* --- Adresse ---------------------------------------------------- */}
        <Spacer size="lg" />
        <Surface padding="base" elevation={0} bordered>
          <Text variant="caption" color="textMuted">
            {order.fulfillment === 'PICKUP' ? 'Retrait sur place' : 'Livraison à'}
          </Text>
          <Text variant="bodyStrong" style={{ marginTop: 2 }}>
            {order.fulfillment === 'PICKUP'
              ? (restaurant?.name ?? 'Au restaurant')
              : `${order.delivery_address}${order.delivery_commune ? `, ${order.delivery_commune}` : ''}`}
          </Text>
          {order.delivery_notes ? (
            <Text variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
              {order.delivery_notes}
            </Text>
          ) : null}

          <Divider spacing="md" />

          <Text variant="caption" color="textMuted">
            Contact
          </Text>
          <Text variant="body" style={{ marginTop: 2 }}>
            {order.contact_name} · {formatPhone(order.contact_phone)}
          </Text>
        </Surface>

        {/* --- Détail ------------------------------------------------------ */}
        <Spacer size="lg" />
        <OrderItems order={order} />

        {/* --- Annulation --------------------------------------------------- */}
        {customerCanCancel(order.status) ? (
          <>
            <Spacer size="xl" />
            <Button
              label="Annuler ma commande"
              variant="ghost"
              icon={<XCircle size={theme.iconSize.sm} color={theme.colors.danger} />}
              onPress={confirmCancel}
              loading={cancelOrder.isPending}
              style={{ alignSelf: 'center' }}
            />
            <Text variant="caption" color="textMuted" align="center" style={{ marginTop: 4 }}>
              Possible tant que la préparation n’a pas commencé.
            </Text>
          </>
        ) : null}

        {isDelivered ? (
          <>
            <Spacer size="lg" />
            <RatingCard orderId={order.id} hasDriver={Boolean(order.delivery)} />

            <Spacer size="xl" />
            <Button
              label="Commander à nouveau"
              onPress={() => {
                // Même logique que l'historique : on repart de l'instantané de
                // la commande, sans refetch, et le panier reste modifiable.
                const { added, hadOptions } = refillCartFromOrder(order);
                if (added === 0) {
                  toast.info('Ces plats ne sont plus au menu. Découvrez la carte du jour.');
                  router.replace('/(tabs)/menu');
                  return;
                }
                toast.success(
                  hadOptions
                    ? 'Panier rempli — vérifiez vos suppléments avant de commander.'
                    : 'Panier rempli à partir de votre commande.',
                );
                router.push('/cart');
              }}
              fullWidth
              size="lg"
            />
          </>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

/**
 * Notation post-livraison.
 *
 * Affichée sur la commande livrée tant qu'elle n'a pas été notée, puis
 * remplacée par un récapitulatif. Les garde-fous (une note, commande livrée,
 * propriétaire uniquement) sont côté serveur.
 */
function RatingCard({ orderId, hasDriver }: { orderId: string; hasDriver: boolean }) {
  const theme = useTheme();
  const toast = useToast();
  const { data: review, isLoading } = useOrderReview(orderId);
  const submit = useSubmitReview();

  const [foodRating, setFoodRating] = useState<number | null>(null);
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return null;

  if (review) {
    return (
      <Surface padding="base" elevation={0} bordered>
        <Text variant="h3">Merci pour votre note ⭐</Text>
        <Spacer size="md" />
        <View style={{ gap: theme.spacing.md }}>
          {review.food_rating != null ? (
            <StarRating value={review.food_rating} size={22} label="Votre repas" />
          ) : null}
          {review.driver_rating != null ? (
            <StarRating value={review.driver_rating} size={22} label="Votre livreur" />
          ) : null}
        </View>
        {review.comment ? (
          <Text variant="bodySmall" color="textSecondary" style={{ marginTop: theme.spacing.md }}>
            « {review.comment} »
          </Text>
        ) : null}
      </Surface>
    );
  }

  const canSubmit = foodRating != null || driverRating != null;

  const handleSubmit = async () => {
    setError(null);
    try {
      await submit.mutateAsync({
        orderId,
        foodRating,
        driverRating: hasDriver ? driverRating : null,
        comment,
      });
      toast.success('Merci, votre note a bien été envoyée !');
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Surface padding="base" elevation={0} bordered>
      <Text variant="h3">Comment c’était ?</Text>
      <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
        Votre note aide le restaurant et le livreur à s’améliorer.
      </Text>

      <Spacer size="base" />
      <View style={{ gap: theme.spacing.base }}>
        <StarRating value={foodRating} onChange={setFoodRating} label="Le repas" />
        {hasDriver ? (
          <StarRating value={driverRating} onChange={setDriverRating} label="Le livreur" />
        ) : null}
      </View>

      <Spacer size="base" />
      <Input
        label="Votre commentaire"
        placeholder="Un mot pour la cuisine ? (facultatif)"
        value={comment}
        onChangeText={setComment}
        multiline
      />

      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: theme.spacing.sm }}>
          {error}
        </Text>
      ) : null}

      <Spacer size="base" />
      <Button
        label="Envoyer ma note"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={submit.isPending}
        fullWidth
      />
    </Surface>
  );
}

function OrderItems({ order }: { order: OrderDetail }) {
  const theme = useTheme();

  // `items` peut manquer si un cache ancien/incomplet a été restauré :
  // mieux vaut une liste vide le temps du refetch qu'un écran rouge.
  const items = order.items ?? [];

  return (
    <Surface padding="base" elevation={0} bordered>
      <Text variant="h3">Votre commande</Text>
      <Spacer size="md" />

      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <Divider spacing="md" /> : null}
          <View style={styles.itemRow}>
            <View
              style={[
                styles.quantityChip,
                { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm },
              ]}
            >
              <Text variant="labelStrong" tabular style={{ color: theme.colors.onPrimarySoft }}>
                {item.quantity}×
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text variant="body">{item.product_name}</Text>
              {item.options.length > 0 ? (
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {summarizeOptions(item.options.map((option) => ({ option_name: option.option_name })))}
                </Text>
              ) : null}
              {item.note ? (
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                  « {item.note} »
                </Text>
              ) : null}
            </View>

            <Text variant="labelStrong" tabular>
              {formatMoney(item.line_total, order.currency)}
            </Text>
          </View>
        </View>
      ))}

      <Divider spacing="lg" />

      <SummaryRow label="Sous-total" value={formatMoney(order.subtotal, order.currency)} />
      {order.delivery_fee > 0 ? (
        <SummaryRow label="Livraison" value={formatMoney(order.delivery_fee, order.currency)} />
      ) : null}
      {order.service_fee > 0 ? (
        <SummaryRow label="Frais de service" value={formatMoney(order.service_fee, order.currency)} />
      ) : null}
      {order.discount_amount > 0 ? (
        <SummaryRow
          label={order.promotion_code ? `Réduction · ${order.promotion_code}` : 'Réduction'}
          value={`−${formatMoney(order.discount_amount, order.currency)}`}
          tone="success"
        />
      ) : null}

      <Divider spacing="md" />

      <View style={styles.rowBetween}>
        <Text variant="h3">Total</Text>
        <Text variant="priceLarge" tabular>
          {formatMoney(order.total, order.currency)}
        </Text>
      </View>

      <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.sm }}>
        {order.payment?.provider === 'CASH'
          ? 'Paiement en espèces à la livraison'
          : 'Paiement enregistré'}
      </Text>
    </Surface>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <View style={[styles.rowBetween, { marginBottom: 8 }]}>
      <Text variant="body" color={tone === 'success' ? 'success' : 'textSecondary'}>
        {label}
      </Text>
      <Text variant="bodyStrong" color={tone === 'success' ? 'success' : 'text'} tabular>
        {value}
      </Text>
    </View>
  );
}

function TrackingSkeleton() {
  const theme = useTheme();
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={() => goBack(BACK_FALLBACK)} />
      <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.base }}>
        <Skeleton height={220} radius={theme.radius.lg} />
        <Skeleton height={96} radius={theme.radius.lg} />
        <Skeleton height={180} radius={theme.radius.lg} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  callButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  quantityChip: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 34, alignItems: 'center' },
});
