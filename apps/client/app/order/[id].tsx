import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
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
  summarizeOptions,
  useCancelOrder,
  useConfirmationCode,
  useOrder,
  useOrderRealtime,
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
  OrderTimeline,
  Pressable,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';

/**
 * Suivi de commande.
 *
 * Écran temps réel : `useOrderRealtime` invalide la requête à chaque
 * changement de statut, d'où une timeline qui avance toute seule sans que le
 * client ait à tirer pour rafraîchir.
 */
export default function OrderTracking() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, refetch } = useOrder(id ?? null);
  useOrderRealtime(id ?? null);

  const cancelOrder = useCancelOrder();

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

  if (isLoading) return <TrackingSkeleton />;
  if (isError || !order) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header onBack={() => router.back()} />
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
        onBack={() => router.back()}
      />

      <ScreenScroll>
        {/* --- Statut ---------------------------------------------------- */}
        <Surface padding="lg" elevation={2}>
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

          <Divider spacing="lg" />

          <OrderTimeline status={order.status} timestamps={timestamps} formatTime={formatTime} />
        </Surface>

        {/* --- Code de confirmation -------------------------------------- */}
        {confirmationCode && !isDelivered && !isCancelled ? (
          <>
            <Spacer size="lg" />
            <Surface padding="lg" elevation={1}>
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
            <Surface padding="base" elevation={1}>
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
        <Surface padding="base" elevation={1}>
          <Text variant="caption" color="textMuted">
            {order.fulfillment === 'PICKUP' ? 'Retrait sur place' : 'Livraison à'}
          </Text>
          <Text variant="bodyStrong" style={{ marginTop: 2 }}>
            {order.fulfillment === 'PICKUP'
              ? 'Istanbul Fast Food'
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
              onPress={() =>
                cancelOrder.mutate({ orderId: order.id, reason: 'Annulée par le client' })
              }
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
            <Spacer size="xl" />
            <Button
              label="Commander à nouveau"
              onPress={() => router.replace('/(tabs)/menu')}
              fullWidth
              size="lg"
            />
          </>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function OrderItems({ order }: { order: OrderDetail }) {
  const theme = useTheme();

  return (
    <Surface padding="base" elevation={1}>
      <Text variant="h3">Votre commande</Text>
      <Spacer size="md" />

      {order.items.map((item, index) => (
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
      <Header onBack={() => router.back()} />
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
