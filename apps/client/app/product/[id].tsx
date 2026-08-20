import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Fire, Heart, X } from 'phosphor-react-native';
import {
  defaultSelection,
  formatMoney,
  productPriceWithOptions,
  selectProductQuantity,
  toggleOption,
  useCartStore,
  useFavoriteIds,
  useProduct,
  useProfile,
  useRestaurant,
  useToggleFavorite,
  validateOptionSelection,
} from '@istanbul/core';
import type { ProductOptionGroup } from '@istanbul/types';
import {
  Badge,
  BottomBar,
  Button,
  Divider,
  ErrorState,
  Input,
  Pressable,
  QuantityStepper,
  Screen,
  Skeleton,
  Spacer,
  Text,
  useTheme,
  useToast,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';

/** Diamètre des boutons ronds du hero (fermer, favori). */
const CIRCLE_BUTTON_SIZE = 40;

/**
 * Fiche produit.
 *
 * Le prix se recalcule à chaque option cochée, et le bouton du bas affiche
 * toujours le montant exact qui sera ajouté au panier — pas de surprise à
 * l'étape suivante.
 */
export default function ProductDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: product, isLoading, isError, refetch } = useProduct(id ?? null);
  const { data: restaurant } = useRestaurant(restaurantId);
  const { profile } = useProfile();
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const addLine = useCartStore((state) => state.addLine);
  // Quantité déjà au panier, tous variants confondus : sans elle, le client
  // rajoute un plat en croyant que le premier ajout n'a pas été pris.
  const inCartQuantity = useCartStore(selectProductQuantity(id ?? ''));

  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  // Pré-sélection des options par défaut dès que la fiche est chargée :
  // l'utilisateur ne doit jamais arriver sur un formulaire déjà invalide.
  useEffect(() => {
    if (product) setSelected(defaultSelection(product.option_groups));
  }, [product]);

  const errors = useMemo(
    () => (product ? validateOptionSelection(product.option_groups, selected) : []),
    [product, selected],
  );

  const total = useMemo(
    () => (product ? productPriceWithOptions(product, product.option_groups, selected, quantity) : 0),
    [product, selected, quantity],
  );

  if (isLoading) return <ProductSkeleton />;
  if (isError || !product) {
    return (
      <Screen>
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const currency = restaurant?.currency;
  const isFavorite = favoriteIds.has(product.id);
  const unavailable = !product.is_available;

  const handleAdd = () => {
    if (errors.length > 0) {
      setShowErrors(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    addLine(product, selected, quantity, note.trim() || null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // La fiche se ferme aussitôt : sans toast, rien ne confirme que l'ajout
    // a bien eu lieu — l'haptique seule est invisible et non accessible.
    toast.success(quantity > 1 ? `${quantity} × ${product.name} ajoutés au panier` : `${product.name} ajouté au panier`);
    router.back();
  };

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* --- Image plein cadre ---------------------------------------- */}
        <View style={styles.hero}>
          <Image
            source={product.image_url}
            placeholder={product.image_blurhash}
            contentFit="cover"
            transition={280}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
            accessibilityLabel={product.name}
          />

          {/* paddingTop calé sur l'inset réel : la valeur fixe passait sous
              la barre de statut des téléphones à encoche. */}
          <View
            style={[
              styles.heroActions,
              {
                paddingTop: insets.top + theme.spacing.sm,
                paddingHorizontal: theme.screenPadding,
              },
            ]}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Fermer"
              // Boutons de 40 : le hitSlop remonte la cible au plancher de 44.
              hitSlop={(theme.hitTarget - CIRCLE_BUTTON_SIZE) / 2}
              style={[styles.circleButton, { backgroundColor: theme.colors.surface }]}
            >
              <X size={theme.iconSize.sm} color={theme.colors.text} weight="bold" />
            </Pressable>

            {profile ? (
              <Pressable
                onPress={() => toggleFavorite.mutate({ productId: product.id, isFavorite })}
                accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                hitSlop={(theme.hitTarget - CIRCLE_BUTTON_SIZE) / 2}
                style={[styles.circleButton, { backgroundColor: theme.colors.surface }]}
              >
                <Heart
                  size={theme.iconSize.sm}
                  color={isFavorite ? theme.colors.primary : theme.colors.text}
                  weight={isFavorite ? 'fill' : 'regular'}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.spacing.xl }}>
          {/* --- Titre et prix ------------------------------------------ */}
          <View style={styles.badgeRow}>
            {product.is_popular ? (
              <Badge
                label="Populaire"
                tone="warning"
                size="sm"
                icon={<Fire size={11} color={theme.colors.warning} weight="fill" />}
              />
            ) : null}
            {product.tags.map((tag) => (
              <Badge key={tag} label={tag} tone="neutral" size="sm" />
            ))}
            {unavailable ? <Badge label="Rupture de stock" tone="danger" size="sm" /> : null}
          </View>

          <Text variant="display" style={{ marginTop: theme.spacing.md }}>
            {product.name}
          </Text>

          {product.description ? (
            <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
              {product.description}
            </Text>
          ) : null}

          <View style={[styles.metaRow, { marginTop: theme.spacing.md }]}>
            <Text variant="priceLarge" tabular color="primary">
              {formatMoney(product.base_price, currency)}
            </Text>
            {product.compare_at_price ? (
              <Text
                variant="body"
                color="textMuted"
                tabular
                style={[styles.strike, { marginLeft: theme.spacing.md }]}
              >
                {formatMoney(product.compare_at_price, currency)}
              </Text>
            ) : null}
          </View>

          <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
            Prêt en {product.prep_minutes} min
            {product.calories ? ` · ${product.calories} kcal` : ''}
          </Text>

          {inCartQuantity > 0 ? (
            <View style={{ marginTop: theme.spacing.sm, alignSelf: 'flex-start' }}>
              <Badge
                label={`Déjà ${inCartQuantity} au panier`}
                tone="info"
                size="sm"
                dot
              />
            </View>
          ) : null}

          {/* --- Groupes d'options -------------------------------------- */}
          {product.option_groups.map((group) => (
            <OptionGroup
              key={group.id}
              group={group}
              selected={selected}
              error={showErrors ? errors.find((issue) => issue.groupId === group.id)?.message : undefined}
              onToggle={(optionId) =>
                setSelected((current) => toggleOption(group, current, optionId))
              }
              currency={currency}
            />
          ))}

          {/* --- Note ---------------------------------------------------- */}
          <Spacer size="xl" />
          <Input
            label="Note pour la cuisine"
            placeholder="Ex. sans oignons, bien cuit…"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={140}
            helper="Facultatif. Nous ferons de notre mieux."
          />
        </View>
      </ScrollView>

      {/* --- Barre d'action ------------------------------------------- */}
      <BottomBar>
        <View style={styles.actionRow}>
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={20} />

          <Button
            label={unavailable ? 'Indisponible' : 'Ajouter au panier'}
            trailing={unavailable ? undefined : formatMoney(total, currency)}
            onPress={handleAdd}
            disabled={unavailable}
            size="lg"
            style={{ flex: 1, marginLeft: theme.spacing.md }}
          />
        </View>
      </BottomBar>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function OptionGroup({
  group,
  selected,
  error,
  onToggle,
  currency,
}: {
  group: ProductOptionGroup;
  selected: string[];
  error?: string;
  onToggle: (optionId: string) => void;
  currency?: string;
}) {
  const theme = useTheme();
  const isSingle = group.selection_type === 'SINGLE';

  return (
    <View style={{ marginTop: theme.spacing['2xl'] }}>
      <View style={styles.groupHeader}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{group.name}</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 1 }}>
            {group.is_required
              ? 'Obligatoire · choisissez-en un'
              : isSingle
                ? 'Facultatif'
                : `Facultatif · jusqu’à ${group.max_select}`}
          </Text>
        </View>

        {group.is_required ? <Badge label="Requis" tone="neutral" size="sm" /> : null}
      </View>

      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: theme.spacing.xs }}>
          {error}
        </Text>
      ) : null}

      <View style={{ marginTop: theme.spacing.md }}>
        {group.options.map((option, index) => {
          const isSelected = selected.includes(option.id);
          const disabled = !option.is_available;

          return (
            <View key={option.id}>
              {index > 0 ? <Divider /> : null}

              <Pressable
                onPress={() => !disabled && onToggle(option.id)}
                disabled={disabled}
                noScale
                accessibilityRole={isSingle ? 'radio' : 'checkbox'}
                accessibilityState={{ checked: isSelected, disabled }}
                accessibilityLabel={`${option.name}${
                  option.price_delta ? `, ${formatMoney(option.price_delta, currency)}` : ''
                }`}
                style={[styles.optionRow, { paddingVertical: theme.spacing.md }]}
              >
                <View
                  style={[
                    isSingle ? styles.radio : styles.checkbox,
                    {
                      borderColor: isSelected ? theme.colors.primary : theme.colors.borderStrong,
                      backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                    },
                  ]}
                >
                  {isSelected ? (
                    isSingle ? (
                      <View
                        style={[styles.radioDot, { backgroundColor: theme.colors.textOnPrimary }]}
                      />
                    ) : (
                      <Check size={12} color={theme.colors.textOnPrimary} weight="bold" />
                    )
                  ) : null}
                </View>

                <Text
                  variant="body"
                  color={disabled ? 'textMuted' : 'text'}
                  style={{ flex: 1, marginLeft: theme.spacing.md }}
                >
                  {option.name}
                  {disabled ? ' (indisponible)' : ''}
                </Text>

                {option.price_delta !== 0 ? (
                  <Text variant="labelStrong" color={isSelected ? 'primary' : 'textSecondary'} tabular>
                    {option.price_delta > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(option.price_delta), currency)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProductSkeleton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen edges={['left', 'right']}>
      <Skeleton height={300} radius={0} />
      <View style={{ padding: theme.screenPadding, gap: theme.spacing.md }}>
        <Skeleton width="60%" height={28} />
        <Skeleton width="90%" height={16} />
        <Skeleton width="35%" height={24} />
        <Skeleton width="100%" height={120} radius={theme.radius.lg} />
      </View>

      {/* La croix reste disponible pendant le chargement : sur un réseau
          lent, l'utilisateur ne doit jamais être prisonnier de la modale. */}
      <View
        style={[
          styles.heroActions,
          { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.screenPadding },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Fermer"
          hitSlop={(theme.hitTarget - CIRCLE_BUTTON_SIZE) / 2}
          style={[styles.circleButton, { backgroundColor: theme.colors.surface }]}
        >
          <X size={theme.iconSize.sm} color={theme.colors.text} weight="bold" />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 3 / 2 },
  heroActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: CIRCLE_BUTTON_SIZE,
    height: CIRCLE_BUTTON_SIZE,
    borderRadius: CIRCLE_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline' },
  strike: { textDecorationLine: 'line-through' },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
});
