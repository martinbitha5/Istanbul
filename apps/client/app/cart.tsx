import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { ShoppingBagOpen } from 'phosphor-react-native';
import {
  cartSubtotal,
  formatMoney,
  lineTotal,
  summarizeOptions,
  useCartStore,
  useRestaurant,
} from '@istanbul/core';
import type { CartLine } from '@istanbul/types';
import {
  BottomBar,
  Button,
  Divider,
  EmptyState,
  Header,
  InlineAlert,
  QuantityStepper,
  Screen,
  ScreenScroll,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';
import { BOTTOM_BAR_INSET } from '@/lib/layout';

/**
 * Panier.
 *
 * Vue purement locale : aucun appel réseau, donc aucun état de chargement.
 * Le seul chiffre affiché ici est le sous-total — les frais de livraison
 * dépendent de l'adresse, qui se choisit au checkout. Annoncer un total
 * incomplet ici serait trompeur.
 */
export default function Cart() {
  const theme = useTheme();
  const { data: restaurant } = useRestaurant(restaurantId);

  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const clear = useCartStore((state) => state.clear);

  const subtotal = useMemo(() => cartSubtotal(lines), [lines]);
  const currency = restaurant?.currency;
  const minOrder = restaurant?.min_order_amount ?? 0;
  const belowMinimum = subtotal < minOrder;

  // Vider est irréversible et le bouton vit à un pouce du stepper : sans
  // confirmation, un tap raté effaçait tout le panier en silence.
  const confirmClear = () => {
    Alert.alert('Vider le panier ?', 'Tous les articles seront retirés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: clear },
    ]);
  };

  if (lines.length === 0) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header title="Mon panier" onBack={() => router.back()} />
        <EmptyState
          title="Votre panier est vide"
          description="Parcourez le menu et ajoutez vos plats préférés."
          actionLabel="Voir le menu"
          onAction={() => router.replace('/(tabs)/menu')}
          icon={<ShoppingBagOpen size={32} color={theme.colors.textMuted} weight="duotone" />}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header
        title="Mon panier"
        subtitle={`${lines.length} ligne${lines.length > 1 ? 's' : ''}`}
        onBack={() => router.back()}
      />

      <ScreenScroll bottomInset={BOTTOM_BAR_INSET}>
        <Surface padding="base" elevation={1}>
          {lines.map((line, index) => (
            <Animated.View key={line.key} layout={LinearTransition.duration(theme.duration.base)}>
              {index > 0 ? <Divider spacing="md" /> : null}
              <CartLineRow
                line={line}
                currency={currency}
                onChangeQuantity={(quantity) => {
                  // Retour tactile discret : le stepper est l'élément le plus
                  // manipulé du panier, la confirmation doit se sentir.
                  void Haptics.selectionAsync();
                  setQuantity(line.key, quantity);
                }}
                onRemove={() => {
                  void Haptics.selectionAsync();
                  removeLine(line.key);
                }}
              />
            </Animated.View>
          ))}
        </Surface>

        <Spacer size="lg" />

        <View style={styles.rowBetween}>
          <Text variant="body" color="textSecondary">
            Sous-total
          </Text>
          <Text variant="priceSmall" tabular>
            {formatMoney(subtotal, currency)}
          </Text>
        </View>

        <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
          Les frais de livraison seront calculés selon votre adresse à l’étape suivante.
        </Text>

        {belowMinimum ? (
          <InlineAlert
            tone="warning"
            message={`Commande minimum de ${formatMoney(minOrder, currency)}. Ajoutez encore ${formatMoney(minOrder - subtotal, currency)}.`}
            style={{ marginTop: theme.spacing.base }}
          />
        ) : null}

        <Spacer size="xl" />

        <Button
          label="Vider le panier"
          variant="ghost"
          onPress={confirmClear}
          style={{ alignSelf: 'center' }}
        />
      </ScreenScroll>

      <BottomBar>
        <Button
          label="Passer la commande"
          trailing={formatMoney(subtotal, currency)}
          onPress={() => router.push('/checkout')}
          disabled={belowMinimum}
          fullWidth
          size="lg"
        />
      </BottomBar>
    </Screen>
  );
}

function CartLineRow({
  line,
  currency,
  onChangeQuantity,
  onRemove,
}: {
  line: CartLine;
  currency?: string;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const options = summarizeOptions(line.options);

  return (
    <View style={styles.line}>
      <Image
        source={line.product_image}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={[styles.thumb, { borderRadius: theme.radius.md }]}
        accessibilityLabel={line.product_name}
      />

      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text variant="h3" numberOfLines={2}>
          {line.product_name}
        </Text>

        {options ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
            {options}
          </Text>
        ) : null}

        {line.note ? (
          <Text variant="caption" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
            « {line.note} »
          </Text>
        ) : null}

        <View style={[styles.rowBetween, { marginTop: theme.spacing.md }]}>
          <QuantityStepper
            value={line.quantity}
            onChange={onChangeQuantity}
            size="sm"
            deletable
            onDelete={onRemove}
          />
          <Text variant="priceSmall" tabular>
            {formatMoney(lineTotal(line), currency)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row' },
  thumb: { width: 76, height: 76 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
