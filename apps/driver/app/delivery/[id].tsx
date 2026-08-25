import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';
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
  roadDistanceKm,
  roughEtaMinutes,
  summarizeOptions,
  toUserMessage,
  useAdvanceDelivery,
  useConfirmDelivery,
  useDelivery,
  useDriverLocation,
  useDriverLocationRealtime,
} from '@istanbul/core';
import {
  Badge,
  BottomBar,
  Button,
  Divider,
  ErrorState,
  Header,
  IconBubble,
  InlineAlert,
  Input,
  Pressable,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  TrackingMap,
  useTheme,
  useToast,
} from '@istanbul/ui';
import type { MapRouteInfo } from '@istanbul/map';
import { Row } from '@/components/Row';
import { useIsOffline } from '@/hooks/useIsOffline';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { RESTAURANT } from '@/lib/restaurant';

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
  const toast = useToast();
  const offline = useIsOffline();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: delivery, isLoading, isError, refetch } = useDelivery(id ?? null);
  const advance = useAdvanceDelivery();
  const confirm = useConfirmDelivery();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  // Le serveur n'expose pas le nombre de tentatives restantes : après un
  // premier échec on prévient au moins que cinq échecs bloquent la course.
  const [codeFailed, setCodeFailed] = useState(false);
  // Hauteur réelle de la barre d'action, mesurée par onLayout : les valeurs
  // codées en dur (220/110) débordaient dès que la police système grossissait.
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  // Distance et durée routières renvoyées par la carte (Mapbox Directions,
  // trafic compris). Le calcul à vol d'oiseau ne sert plus que d'attente.
  const [route, setRoute] = useState<MapRouteInfo | null>(null);

  useLocationTracking(id ?? null, Boolean(delivery && delivery.status !== 'DELIVERED'));

  // Sa propre trace GPS (remontée par useLocationTracking) alimente la carte :
  // même source de vérité que ce que voient le client et le dashboard.
  const { data: myLocation } = useDriverLocation(
    id ?? null,
    Boolean(delivery && delivery.status !== 'DELIVERED'),
  );
  useDriverLocationRealtime(delivery && delivery.status !== 'DELIVERED' ? (id ?? null) : null);

  // Prochaine étape : le restaurant tant que la commande n'est pas
  // récupérée, le client ensuite. C'est aussi ce que la carte doit tracer —
  // un itinéraire vers le client pendant que le livreur roule vers la cuisine
  // ne lui sert à rien.
  const pickupPhase = delivery
    ? ['ACCEPTED', 'HEADING_TO_RESTAURANT'].includes(delivery.status)
    : true;

  // Recalculé seulement quand la position ou le statut changent — pas à
  // chaque rendu.
  const distanceLabel = useMemo(() => {
    if (!delivery) return null;
    const target = pickupPhase ? 'Restaurant' : 'Client';

    // L'itinéraire de la carte fait autorité dès qu'il est arrivé.
    if (route) {
      return `${target} à ${route.distanceKm.toLocaleString('fr-FR')} km · ${route.durationMin} min`;
    }

    if (!myLocation) return null;

    const order = delivery.order;
    const coords = pickupPhase
      ? RESTAURANT.coords
      : order.delivery_latitude != null && order.delivery_longitude != null
        ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
        : null;
    if (!coords) return 'Itinéraire en pointillés sur la carte';

    const km = roadDistanceKm(
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      coords,
    );
    return `${target} à ~${km.toLocaleString('fr-FR')} km · ${roughEtaMinutes(km)} min`;
  }, [delivery, myLocation, pickupPhase, route]);

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
    // Confirmation avant chaque avancement : la machine à états ne revient
    // jamais en arrière, un tap accidentel serait irréversible.
    Alert.alert(
      'Confirmer',
      `${deliveryNextActionLabel[delivery.status] ?? 'Étape suivante'} — cette action est définitive.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            advance.mutate({ deliveryId: delivery.id, to: next });
          },
        },
      ],
    );
  };

  const handleConfirm = async () => {
    if (code.trim().length !== 4) {
      setCodeError('Le code contient 4 chiffres.');
      return;
    }

    // Hors réseau, la mutation (`networkMode: 'online'`) resterait en attente
    // sans jamais se résoudre : spinner éternel devant le client. On prévient
    // immédiatement au lieu de lancer un `await` qui ne reviendra pas.
    if (offline) {
      setCodeError('Vous êtes hors ligne. La validation partira au retour du réseau.');
      return;
    }

    setCodeError(null);
    try {
      await confirm.mutateAsync({ deliveryId: delivery.id, code: code.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Le gain de la course avec la confirmation : la seule information que
      // le livreur attend vraiment à cet instant.
      toast.success(`Livraison terminée · +${formatMoney(delivery.payout_amount, order.currency)}`);
      router.replace('/(tabs)');
    } catch (error) {
      // Le compteur de tentatives est côté serveur : au bout de cinq échecs la
      // course se bloque et il faut passer par le restaurant.
      setCodeError(toUserMessage(error));
      setCodeFailed(true);
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

      {/* Le champ code a l'autoFocus et la barre d'action est ancrée en bas :
          sans KeyboardAvoidingView, le clavier masque le bouton de validation. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenScroll bottomInset={bottomBarHeight + theme.spacing.base}>
          {/* --- Carte de la course ---------------------------------------- */}
          {!isDone ? (
            <>
              <TrackingMap
                restaurant={RESTAURANT.coords}
                destination={
                  order.delivery_latitude != null && order.delivery_longitude != null
                    ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
                    : null
                }
                driver={
                  myLocation
                    ? { latitude: myLocation.latitude, longitude: myLocation.longitude }
                    : null
                }
                labels={{ restaurant: RESTAURANT.name, driver: 'Vous' }}
                height={200}
                showRoute
                routeTo={pickupPhase ? 'restaurant' : 'destination'}
                onRoute={setRoute}
                // Forme objet et non gabarit : les types de routes générés par
                // expo-router n'exposent cette route qu'ainsi dans ce monorepo.
                onPress={() =>
                  router.push({ pathname: '/navigate/[id]', params: { id: delivery.id } })
                }
              />
              {distanceLabel ? (
                <Text
                  variant="caption"
                  color="textSecondary"
                  align="center"
                  tabular
                  style={{ marginTop: theme.spacing.sm }}
                >
                  {distanceLabel}
                </Text>
              ) : null}
              <Spacer size="md" />
            </>
          ) : null}

          {/* --- Étape 1 : le restaurant --------------------------------- */}
          <StepCard
            active={['ACCEPTED', 'HEADING_TO_RESTAURANT'].includes(delivery.status)}
            done={['PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED', 'DELIVERED'].includes(
              delivery.status,
            )}
            icon={<Storefront size={theme.iconSize.md} color={theme.colors.primary} weight="fill" />}
            title={RESTAURANT.name}
            subtitle={RESTAURANT.address}
            onNavigate={() =>
              openNavigation(
                RESTAURANT.coords.latitude,
                RESTAURANT.coords.longitude,
                RESTAURANT.name,
              )
            }
            onCall={() => void Linking.openURL(`tel:${RESTAURANT.phone}`)}
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
            // Pas de téléphone → pas de bouton : un `tel:undefined` ouvre un
            // composeur vide et fait perdre du temps au livreur.
            onCall={
              order.contact_phone
                ? () => void Linking.openURL(`tel:${order.contact_phone}`)
                : undefined
            }
            phone={order.contact_phone}
          />

          {/* --- Contenu de la commande ---------------------------------- */}
          <Spacer size="lg" />
          <Surface padding="base" elevation={0} bordered>
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
                      <InlineAlert
                        tone="warning"
                        message={item.note}
                        style={{ marginTop: theme.spacing.xs }}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </Surface>

          {/* --- Argent ---------------------------------------------------- */}
          <Spacer size="lg" />
          <Surface padding="base" elevation={0} bordered>
            <Row>
              <Text variant="body" color="textSecondary">
                Total de la commande
              </Text>
              <Text variant="bodyStrong" tabular>
                {formatMoney(order.total, order.currency)}
              </Text>
            </Row>

            <Divider spacing="md" />

            <Row>
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
            </Row>

            <Divider spacing="md" />

            <Row>
              <Text variant="body" color="textSecondary">
                Votre gain
              </Text>
              <Text variant="priceSmall" tabular color="success">
                {formatMoney(delivery.payout_amount, order.currency)}
              </Text>
            </Row>
          </Surface>

          {/* --- Saisie du code ------------------------------------------- */}
          {needsCode ? (
            <>
              <Spacer size="lg" />
              <Surface padding="base" elevation={0} bordered>
                <Text variant="h3">Code de confirmation</Text>
                <Text variant="bodySmall" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
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

                {codeFailed ? (
                  <InlineAlert
                    tone="warning"
                    message="Attention : 5 échecs bloquent la course. Vérifiez le code avec le client."
                    style={{ marginTop: theme.spacing.md }}
                  />
                ) : null}
              </Surface>
            </>
          ) : null}

          {/* --- Mutation en attente de réseau ---------------------------- */}
          {advance.isPaused || confirm.isPaused ? (
            <>
              <Spacer size="lg" />
              <InlineAlert
                tone="warning"
                message="Pas de réseau pour le moment : votre action partira automatiquement dès que la connexion revient."
              />
            </>
          ) : null}
        </ScreenScroll>

        {/* --- Action unique -------------------------------------------- */}
        {!isDone ? (
          <View onLayout={(event) => setBottomBarHeight(event.nativeEvent.layout.height)}>
            <BottomBar>
              {needsCode ? (
                <Button
                  label={confirm.isPaused ? 'En attente de réseau…' : 'Valider la livraison'}
                  onPress={() => void handleConfirm()}
                  loading={confirm.isPending && !confirm.isPaused}
                  disabled={code.length !== 4 || confirm.isPaused}
                  fullWidth
                  size="lg"
                />
              ) : next ? (
                <Button
                  label={
                    advance.isPaused
                      ? 'En attente de réseau…'
                      : (deliveryNextActionLabel[delivery.status] ?? 'Étape suivante')
                  }
                  onPress={handleAdvance}
                  loading={advance.isPending && !advance.isPaused}
                  disabled={advance.isPaused}
                  fullWidth
                  size="lg"
                />
              ) : null}
            </BottomBar>
          </View>
        ) : null}
      </KeyboardAvoidingView>
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
        <IconBubble size={theme.hitTarget} tone="primary">
          {icon}
        </IconBubble>

        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
          {phone ? (
            <Text variant="caption" color="textMuted" tabular style={{ marginTop: theme.spacing.xxs }}>
              {formatPhone(phone)}
            </Text>
          ) : null}
        </View>
      </View>

      {note ? (
        <InlineAlert tone="warning" message={note} style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <View style={[styles.stepActions, { marginTop: theme.spacing.md }]}>
        {onNavigate ? (
          <Button
            label="Itinéraire"
            variant="secondary"
            size="sm"
            icon={
              <NavigationArrow size={theme.iconSize.xs} color={theme.colors.text} weight="fill" />
            }
            onPress={onNavigate}
            style={{ flex: 1 }}
          />
        ) : null}

        {onCall ? (
          <Pressable
            onPress={onCall}
            accessibilityLabel={`Appeler ${title}`}
            style={[
              // hitTarget (44 pt) : l'ancien 40×40 était sous le plancher
              // tactile — critique pour un pouce ganté sur une moto.
              {
                width: theme.hitTarget,
                height: theme.hitTarget,
                alignItems: 'center',
                justifyContent: 'center',
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
  stepHeader: { flexDirection: 'row', alignItems: 'center' },
  stepActions: { flexDirection: 'row', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
});
