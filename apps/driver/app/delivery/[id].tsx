import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { NavigationArrow, Phone, Storefront, User } from 'phosphor-react-native';
import {
  deliveryNextActionLabel,
  deliveryStatusLabel,
  deliveryStatusTone,
  formatMoney,
  formatPhone,
  nextDeliveryStatus,
  summarizeOptions,
  toUserMessage,
  useAdvanceDelivery,
  useConfirmDelivery,
  useDelivery,
} from '@istanbul/core';
import {
  Badge,
  BottomBar,
  Button,
  Divider,
  ErrorState,
  Header,
  Input,
  Pressable,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { useLocationTracking } from '@/hooks/useLocationTracking';

const RESTAURANT_COORDS = { latitude: -4.3735, longitude: 15.2662 };

/**
 * Détail d'une course.
 *
 * Un seul bouton d'action, toujours au même endroit, qui décrit l'étape
 * suivante en langage naturel : « Je pars au restaurant », « J'ai récupéré la
 * commande ». Le livreur conduit — il ne doit jamais avoir à réfléchir à
 * quel bouton appuyer.
 */
export default function DeliveryDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: delivery, isLoading, isError, refetch } = useDelivery(id ?? null);
  const advance = useAdvanceDelivery();
  const confirm = useConfirmDelivery();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useLocationTracking(id ?? null, Boolean(delivery && delivery.status !== 'DELIVERED'));

  if (isLoading) return <DeliverySkeleton />;
  if (isError || !delivery) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header onBack={() => router.back()} />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const order = delivery.order;
  const next = nextDeliveryStatus(delivery.status);
  const needsCode = delivery.status === 'ARRIVED';
  const isDone = delivery.status === 'DELIVERED';

  const openNavigation = (latitude: number, longitude: number, label: string) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}&dirflg=d`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url!).catch(() => {
      Alert.alert('Navigation indisponible', `Destination : ${label}`);
    });
  };

  const handleAdvance = () => {
    if (!next || needsCode) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advance.mutate({ deliveryId: delivery.id, to: next });
  };

  const handleConfirm = async () => {
    if (code.trim().length !== 4) {
      setCodeError('Le code contient 4 chiffres.');
      return;
    }

    setCodeError(null);
    try {
      await confirm.mutateAsync({ deliveryId: delivery.id, code: code.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (error) {
      // Le compteur de tentatives est côté serveur : au bout de cinq échecs la
      // course se bloque et il faut passer par le restaurant.
      setCodeError(toUserMessage(error));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header
        title={order.order_number}
        subtitle={deliveryStatusLabel[delivery.status]}
        onBack={() => router.back()}
        right={
          <Badge
            label={deliveryStatusLabel[delivery.status]}
            tone={deliveryStatusTone[delivery.status]}
            size="sm"
          />
        }
      />

      <ScreenScroll bottomInset={needsCode ? 220 : 110}>
        {/* --- Étape 1 : le restaurant --------------------------------- */}
        <StepCard
          active={['ACCEPTED', 'HEADING_TO_RESTAURANT'].includes(delivery.status)}
          done={['PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED', 'DELIVERED'].includes(
            delivery.status,
          )}
          icon={<Storefront size={theme.iconSize.md} color={theme.colors.primary} weight="fill" />}
          title="Istanbul Fast Food"
          subtitle="Avenue Delvaux n°42, Ngaliema"
          onNavigate={() =>
            openNavigation(
              RESTAURANT_COORDS.latitude,
              RESTAURANT_COORDS.longitude,
              'Istanbul Fast Food',
            )
          }
          onCall={() => void Linking.openURL('tel:+243999000111')}
        />

        <Spacer size="md" />

        {/* --- Étape 2 : le client -------------------------------------- */}
        <StepCard
          active={['PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED'].includes(delivery.status)}
          done={delivery.status === 'DELIVERED'}
          icon={<User size={theme.iconSize.md} color={theme.colors.primary} weight="fill" />}
          title={order.contact_name}
          subtitle={`${order.delivery_address}${
            order.delivery_commune ? `, ${order.delivery_commune}` : ''
          }`}
          note={order.delivery_notes}
          onNavigate={
            order.delivery_latitude && order.delivery_longitude
              ? () =>
                  openNavigation(
                    order.delivery_latitude!,
                    order.delivery_longitude!,
                    order.delivery_address ?? '',
                  )
              : undefined
          }
          onCall={() => void Linking.openURL(`tel:${order.contact_phone}`)}
          phone={order.contact_phone}
        />

        {/* --- Contenu de la commande ---------------------------------- */}
        <Spacer size="lg" />
        <Surface padding="base" elevation={1}>
          <Text variant="h3">Contenu de la commande</Text>
          <Spacer size="md" />

          {order.items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider spacing="sm" /> : null}
              <View style={styles.itemRow}>
                <Text variant="bodyStrong" tabular style={{ minWidth: 32 }}>
                  {item.quantity}×
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{item.product_name}</Text>
                  {item.options.length > 0 ? (
                    <Text variant="caption" color="textSecondary">
                      {summarizeOptions(
                        item.options.map((option) => ({ option_name: option.option_name })),
                      )}
                    </Text>
                  ) : null}
                  {item.note ? (
                    <Text variant="caption" color="warning" style={{ marginTop: 2 }}>
                      ⚠ {item.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </Surface>

        {/* --- Argent ---------------------------------------------------- */}
        <Spacer size="lg" />
        <Surface padding="base" elevation={1}>
          <View style={styles.rowBetween}>
            <Text variant="body" color="textSecondary">
              Total de la commande
            </Text>
            <Text variant="bodyStrong" tabular>
              {formatMoney(order.total, order.currency)}
            </Text>
          </View>

          <Divider spacing="md" />

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={delivery.cash_to_collect > 0 ? 'warning' : 'text'}>
                {delivery.cash_to_collect > 0 ? 'À encaisser en espèces' : 'Déjà payée'}
              </Text>
              <Text variant="caption" color="textMuted">
                {order.payment?.provider === 'CASH'
                  ? 'Paiement à la livraison'
                  : 'Paiement électronique'}
              </Text>
            </View>
            <Text
              variant="priceLarge"
              tabular
              color={delivery.cash_to_collect > 0 ? 'warning' : 'success'}
            >
              {formatMoney(delivery.cash_to_collect, order.currency)}
            </Text>
          </View>

          <Divider spacing="md" />

          <View style={styles.rowBetween}>
            <Text variant="body" color="textSecondary">
              Votre gain
            </Text>
            <Text variant="priceSmall" tabular color="success">
              {formatMoney(delivery.payout_amount, order.currency)}
            </Text>
          </View>
        </Surface>

        {/* --- Saisie du code ------------------------------------------- */}
        {needsCode ? (
          <>
            <Spacer size="lg" />
            <Surface padding="base" elevation={2}>
              <Text variant="h3">Code de confirmation</Text>
              <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 4 }}>
                Demandez au client le code à 4 chiffres affiché dans son application.
              </Text>

              <Spacer size="base" />

              <Input
                label="Code du client"
                placeholder="0000"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 4))}
                error={codeError}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
            </Surface>
          </>
        ) : null}
      </ScreenScroll>

      {/* --- Action unique -------------------------------------------- */}
      {!isDone ? (
        <BottomBar>
          {needsCode ? (
            <Button
              label="Valider la livraison"
              onPress={handleConfirm}
              loading={confirm.isPending}
              disabled={code.length !== 4}
              fullWidth
              size="lg"
            />
          ) : next ? (
            <Button
              label={deliveryNextActionLabel[delivery.status] ?? 'Étape suivante'}
              onPress={handleAdvance}
              loading={advance.isPending}
              fullWidth
              size="lg"
            />
          ) : null}
        </BottomBar>
      ) : null}
    </Screen>
  );
}

function StepCard({
  active,
  done,
  icon,
  title,
  subtitle,
  note,
  phone,
  onNavigate,
  onCall,
}: {
  active: boolean;
  done: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  note?: string | null;
  phone?: string;
  onNavigate?: () => void;
  onCall?: () => void;
}) {
  const theme = useTheme();

  return (
    <Surface
      padding="base"
      elevation={active ? 2 : 1}
      style={
        active
          ? { borderLeftWidth: 4, borderLeftColor: theme.colors.primary }
          : { opacity: done ? 0.6 : 1 }
      }
    >
      <View style={styles.stepHeader}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>

        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
          {phone ? (
            <Text variant="caption" color="textMuted" tabular style={{ marginTop: 2 }}>
              {formatPhone(phone)}
            </Text>
          ) : null}
        </View>
      </View>

      {note ? (
        <View
          style={{
            backgroundColor: theme.colors.warningSoft,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
            marginTop: theme.spacing.md,
          }}
        >
          <Text variant="caption" style={{ color: theme.colors.warning }}>
            {note}
          </Text>
        </View>
      ) : null}

      <View style={[styles.stepActions, { marginTop: theme.spacing.md }]}>
        {onNavigate ? (
          <Button
            label="Itinéraire"
            variant="secondary"
            size="sm"
            icon={<NavigationArrow size={16} color={theme.colors.text} weight="fill" />}
            onPress={onNavigate}
            style={{ flex: 1 }}
          />
        ) : null}

        {onCall ? (
          <Pressable
            onPress={onCall}
            accessibilityLabel={`Appeler ${title}`}
            style={[
              styles.callButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.pill,
                marginLeft: onNavigate ? theme.spacing.sm : 0,
              },
            ]}
          >
            <Phone size={theme.iconSize.sm} color={theme.colors.textOnPrimary} weight="fill" />
          </Pressable>
        ) : null}
      </View>
    </Surface>
  );
}

function DeliverySkeleton() {
  const theme = useTheme();
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.base }}>
        <Skeleton height={120} radius={theme.radius.lg} />
        <Skeleton height={140} radius={theme.radius.lg} />
        <Skeleton height={180} radius={theme.radius.lg} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepHeader: { flexDirection: 'row', alignItems: 'center' },
  stepActions: { flexDirection: 'row', alignItems: 'center' },
  callButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
});
