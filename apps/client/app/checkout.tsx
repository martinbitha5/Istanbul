import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  CaretRight,
  Money,
  Motorcycle,
  Note,
  Storefront,
  Tag,
} from 'phosphor-react-native';
import {
  cartSubtotal,
  computeTotals,
  formatEtaRange,
  formatMoney,
  toPlaceOrderItems,
  toUserMessage,
  useAddresses,
  useCartStore,
  useDeliveryQuote,
  useEvaluatePromotion,
  usePlaceOrder,
  useProfile,
  useRestaurant,
  useSession,
} from '@istanbul/core';
import type { PromotionEvaluation } from '@istanbul/types';
import {
  Badge,
  BottomBar,
  Button,
  Divider,
  Header,
  Input,
  ListRow,
  Pressable,
  PriceBreakdown,
  Screen,
  ScreenScroll,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { config } from '@/lib/config';

/**
 * Checkout.
 *
 * Le point où tout doit être exact. Les frais de livraison viennent du
 * serveur (`fn_delivery_quote`) et non d'un calcul local : le prix affiché
 * ici est celui qui sera facturé.
 */
export default function Checkout() {
  const theme = useTheme();
  const { session } = useSession();
  const { profile } = useProfile();

  const { data: restaurant } = useRestaurant(config.restaurantId);
  const { data: addresses } = useAddresses();

  const lines = useCartStore((state) => state.lines);
  const fulfillment = useCartStore((state) => state.fulfillment);
  const setFulfillment = useCartStore((state) => state.setFulfillment);
  const addressId = useCartStore((state) => state.addressId);
  const setAddressId = useCartStore((state) => state.setAddressId);
  const customerNote = useCartStore((state) => state.customerNote);
  const setCustomerNote = useCartStore((state) => state.setCustomerNote);
  const deliveryNotes = useCartStore((state) => state.deliveryNotes);
  const setDeliveryNotes = useCartStore((state) => state.setDeliveryNotes);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promotion, setPromotion] = useState<PromotionEvaluation | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const subtotal = useMemo(() => cartSubtotal(lines), [lines]);

  const address = useMemo(
    () =>
      addresses?.find((candidate) => candidate.id === addressId) ??
      addresses?.find((candidate) => candidate.is_default) ??
      addresses?.[0] ??
      null,
    [addresses, addressId],
  );

  // Pré-remplissage depuis le profil, une seule fois.
  useEffect(() => {
    if (profile) {
      setContactName((current) => current || profile.full_name);
      setContactPhone((current) => current || profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!addressId && address) setAddressId(address.id);
  }, [address, addressId, setAddressId]);

  const isDelivery = fulfillment === 'DELIVERY';

  const quoteQuery = useDeliveryQuote(
    config.restaurantId,
    address?.latitude ?? null,
    address?.longitude ?? null,
    subtotal,
    isDelivery && !!address,
  );

  const evaluatePromo = useEvaluatePromotion();
  const placeOrder = usePlaceOrder();

  const totals = useMemo(
    () =>
      computeTotals({
        lines,
        deliveryQuote: isDelivery ? (quoteQuery.data ?? null) : null,
        promotion,
        serviceFeeBps: restaurant?.service_fee_bps ?? 0,
      }),
    [lines, isDelivery, quoteQuery.data, promotion, restaurant],
  );

  const currency = restaurant?.currency;
  const outOfRange = isDelivery && quoteQuery.data && !quoteQuery.data.in_range;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;

    setPromoError(null);
    try {
      const result = await evaluatePromo.mutateAsync({
        restaurantId: config.restaurantId,
        code,
        subtotal,
        deliveryFee: totals.deliveryFee,
      });

      if (!result.is_valid) {
        setPromotion(null);
        setPromoError(result.reason ?? 'Ce code ne peut pas être appliqué.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      setPromotion(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setPromoError(toUserMessage(error));
    }
  };

  const submit = async () => {
    setFormError(null);

    if (!session) {
      router.push({ pathname: '/(auth)/sign-in', params: { redirect: '/checkout' } });
      return;
    }
    if (!contactName.trim()) {
      setFormError('Indiquez le nom de la personne à contacter.');
      return;
    }
    if (!contactPhone.trim()) {
      setFormError('Indiquez un numéro de téléphone joignable.');
      return;
    }
    if (isDelivery && !address) {
      setFormError('Choisissez une adresse de livraison.');
      return;
    }

    try {
      const order = await placeOrder.mutateAsync({
        restaurantId: config.restaurantId,
        fulfillment,
        items: toPlaceOrderItems(lines),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        addressId: isDelivery ? address!.id : null,
        deliveryNotes,
        customerNote,
        promoCode: promotion ? promoInput.trim() : null,
        paymentProvider: 'CASH',
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/order/${order.id}`);
    } catch (error) {
      // Le serveur a le dernier mot : produit en rupture, promo expirée,
      // adresse hors zone… on affiche son message tel quel.
      setFormError(toUserMessage(error));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header title="Finaliser la commande" onBack={() => router.back()} />

      <ScreenScroll bottomInset={130}>
        {/* --- Mode ---------------------------------------------------- */}
        <Text variant="h3">Comment souhaitez-vous être servi ?</Text>
        <Spacer size="md" />

        <View style={styles.modeRow}>
          <ModeCard
            active={isDelivery}
            title="Livraison"
            subtitle={
              quoteQuery.data?.in_range
                ? formatEtaRange(quoteQuery.data.eta_minutes)
                : 'À votre adresse'
            }
            icon={
              <Motorcycle
                size={theme.iconSize.md}
                color={isDelivery ? theme.colors.primary : theme.colors.textMuted}
                weight={isDelivery ? 'fill' : 'regular'}
              />
            }
            onPress={() => setFulfillment('DELIVERY')}
            disabled={!restaurant?.delivery_enabled}
          />

          <ModeCard
            active={!isDelivery}
            title="Retrait"
            subtitle={`Prêt en ${restaurant?.avg_prep_minutes ?? 25} min`}
            icon={
              <Storefront
                size={theme.iconSize.md}
                color={!isDelivery ? theme.colors.primary : theme.colors.textMuted}
                weight={!isDelivery ? 'fill' : 'regular'}
              />
            }
            onPress={() => setFulfillment('PICKUP')}
            disabled={!restaurant?.pickup_enabled}
          />
        </View>

        <Spacer size="xl" />

        {/* --- Adresse / retrait --------------------------------------- */}
        {isDelivery ? (
          <>
            <Text variant="h3">Adresse de livraison</Text>
            <Spacer size="md" />

            <Surface padding="base" elevation={1}>
              {address ? (
                <Pressable onPress={() => router.push('/addresses')} noScale>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{address.label}</Text>
                      <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                        {address.street}
                        {address.commune ? `, ${address.commune}` : ''}
                      </Text>
                      {address.details ? (
                        <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                          {address.details}
                        </Text>
                      ) : null}
                    </View>
                    <CaretRight size={16} color={theme.colors.textMuted} />
                  </View>
                </Pressable>
              ) : (
                <Button
                  label="Ajouter une adresse"
                  variant="secondary"
                  onPress={() => router.push('/addresses')}
                  fullWidth
                />
              )}

              {quoteQuery.data?.in_range ? (
                <>
                  <Divider spacing="md" />
                  <View style={styles.rowBetween}>
                    <Text variant="label" color="textSecondary">
                      {quoteQuery.data.zone_name}
                      {quoteQuery.data.distance_km ? ` · ${quoteQuery.data.distance_km} km` : ''}
                    </Text>
                    <Text variant="labelStrong" tabular>
                      {quoteQuery.data.fee_amount === 0
                        ? 'Offerte'
                        : formatMoney(quoteQuery.data.fee_amount, currency)}
                    </Text>
                  </View>
                </>
              ) : null}

              {outOfRange ? (
                <>
                  <Divider spacing="md" />
                  <Badge label="Adresse hors zone de livraison" tone="danger" size="sm" />
                  <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
                    Nous ne livrons pas encore à {quoteQuery.data?.distance_km} km. Choisissez le
                    retrait sur place ou une autre adresse.
                  </Text>
                </>
              ) : null}
            </Surface>

            <Spacer size="base" />

            <Input
              label="Instructions pour le livreur"
              placeholder="Ex. maison bleue, klaxonner à l’arrivée"
              value={deliveryNotes ?? ''}
              onChangeText={setDeliveryNotes}
              icon={<Note size={theme.iconSize.sm} color={theme.colors.textMuted} />}
              maxLength={160}
            />
          </>
        ) : (
          <Surface padding="base" elevation={1}>
            <Text variant="bodyStrong">{restaurant?.name}</Text>
            <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
              {restaurant?.address_line}, {restaurant?.city}
            </Text>
            <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.sm }}>
              Présentez votre numéro de commande au comptoir.
            </Text>
          </Surface>
        )}

        <Spacer size="xl" />

        {/* --- Contact -------------------------------------------------- */}
        <Text variant="h3">Contact</Text>
        <Spacer size="md" />

        <Input
          label="Nom"
          value={contactName}
          onChangeText={setContactName}
          required
          autoComplete="name"
        />
        <Spacer size="base" />
        <Input
          label="Téléphone"
          value={contactPhone}
          onChangeText={setContactPhone}
          required
          keyboardType="phone-pad"
          autoComplete="tel"
          helper="Le livreur vous appellera sur ce numéro."
        />

        <Spacer size="xl" />

        {/* --- Code promo ----------------------------------------------- */}
        <Text variant="h3">Code promo</Text>
        <Spacer size="md" />

        <View style={styles.promoRow}>
          <Input
            label="Code"
            placeholder="BIENVENUE"
            value={promoInput}
            onChangeText={(value) => setPromoInput(value.toUpperCase())}
            error={promoError}
            autoCapitalize="characters"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
            icon={<Tag size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />
          <Button
            label="Appliquer"
            variant="secondary"
            onPress={applyPromo}
            loading={evaluatePromo.isPending}
            style={{ marginLeft: theme.spacing.sm, marginTop: 24 }}
          />
        </View>

        {promotion?.is_valid ? (
          <View style={{ marginTop: theme.spacing.sm }}>
            <Badge label={`${promotion.title} appliqué`} tone="success" dot size="sm" />
          </View>
        ) : null}

        <Spacer size="xl" />

        {/* --- Paiement -------------------------------------------------- */}
        <Text variant="h3">Paiement</Text>
        <Spacer size="md" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Paiement à la livraison"
            subtitle="Espèces, à remettre au livreur"
            icon={<Money size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />}
            right={<Badge label="Sélectionné" tone="success" size="sm" />}
          />
          <Divider />
          <ListRow
            title="Mobile money"
            subtitle="M-Pesa, Orange Money, Airtel Money — bientôt disponible"
            icon={<Money size={theme.iconSize.sm} color={theme.colors.textMuted} />}
            right={<Badge label="Bientôt" tone="neutral" size="sm" />}
          />
        </Surface>

        <Spacer size="xl" />

        {/* --- Note ----------------------------------------------------- */}
        <Input
          label="Note pour le restaurant"
          placeholder="Une précision sur votre commande ?"
          value={customerNote ?? ''}
          onChangeText={setCustomerNote}
          multiline
          maxLength={200}
        />

        <Spacer size="xl" />

        {/* --- Récapitulatif -------------------------------------------- */}
        <Surface padding="base" elevation={1}>
          <PriceBreakdown
            subtotal={totals.subtotal}
            deliveryFee={isDelivery ? totals.deliveryFee : 0}
            serviceFee={totals.serviceFee}
            discount={totals.discount}
            total={totals.total}
            currency={currency}
            formatMoney={formatMoney}
            discountLabel={promotion?.title ?? undefined}
            freeDelivery={isDelivery && totals.deliveryFee === 0}
          />
        </Surface>

        {formError ? (
          <Surface
            padding="md"
            elevation={0}
            style={{ backgroundColor: theme.colors.dangerSoft, marginTop: theme.spacing.base }}
          >
            <Text variant="label" color="danger" accessibilityLiveRegion="polite">
              {formError}
            </Text>
          </Surface>
        ) : null}
      </ScreenScroll>

      <BottomBar>
        <Button
          label={session ? 'Confirmer la commande' : 'Se connecter et commander'}
          trailing={formatMoney(totals.total, currency)}
          onPress={submit}
          loading={placeOrder.isPending}
          disabled={Boolean(outOfRange) || lines.length === 0}
          fullWidth
          size="lg"
        />
      </BottomBar>
    </Screen>
  );
}

function ModeCard({
  active,
  title,
  subtitle,
  icon,
  onPress,
  disabled,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.modeCard,
        {
          borderRadius: theme.radius.lg,
          padding: theme.spacing.base,
          borderWidth: active ? theme.borderWidth.thick : theme.borderWidth.hairline,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
        },
      ]}
    >
      {icon}
      <Text variant="bodyStrong" style={{ marginTop: theme.spacing.sm }}>
        {title}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
