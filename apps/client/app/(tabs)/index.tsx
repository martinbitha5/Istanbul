import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CaretRight, MapPin, Storefront } from 'phosphor-react-native';
import {
  cartItemCount,
  cartSubtotal,
  firstName,
  formatEtaRange,
  formatMoney,
  greeting,
  orderStatusCustomerLabel,
  useActiveOrder,
  useAddresses,
  useCartStore,
  useCategories,
  useFavoriteIds,
  useProducts,
  useProfile,
  usePromotions,
  useRestaurant,
  useToggleFavorite,
} from '@istanbul/core';
import type { Product, Promotion } from '@istanbul/types';
import {
  Badge,
  CartBar,
  CategoryChips,
  ErrorState,
  ListSkeleton,
  OfflineBanner,
  Pressable,
  ProductCard,
  Screen,
  SearchBar,
  SectionHeader,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { config } from '@/lib/config';
import { useIsOffline } from '@/providers/AppProviders';

/**
 * Accueil.
 *
 * Salutation, adresse, recherche, catégories, promotions, populaires,
 * recommandés, et le bandeau de commande en cours quand il y en a une.
 */
export default function Home() {
  const theme = useTheme();
  const offline = useIsOffline();

  const { profile } = useProfile();
  const { data: restaurant } = useRestaurant(config.restaurantId);
  const { data: categories } = useCategories(config.restaurantId);
  const { data: promotions } = usePromotions(config.restaurantId);
  const { data: addresses } = useAddresses();
  const { data: activeOrder } = useActiveOrder();

  const popular = useProducts(config.restaurantId, { popularOnly: true, limit: 8 });
  const recommended = useProducts(config.restaurantId, { recommendedOnly: true, limit: 8 });

  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const lines = useCartStore((state) => state.lines);
  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  const defaultAddress = useMemo(
    () => addresses?.find((address) => address.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );

  const isLoading = popular.isLoading && recommended.isLoading;
  const hasError = popular.isError && recommended.isError;

  const refresh = useCallback(() => {
    void popular.refetch();
    void recommended.refetch();
  }, [popular, recommended]);

  const openProduct = (product: Product) => router.push(`/product/${product.id}`);

  const renderProduct = ({ item, index }: { item: Product; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(theme.duration.base)}
      style={styles.carouselItem}
    >
      <ProductCard
        product={item}
        onPress={() => openProduct(item)}
        onToggleFavorite={
          profile
            ? () =>
                toggleFavorite.mutate({
                  productId: item.id,
                  isFavorite: favoriteIds.has(item.id),
                })
            : undefined
        }
        isFavorite={favoriteIds.has(item.id)}
        formatPrice={(cents) => formatMoney(cents, restaurant?.currency)}
      />
    </Animated.View>
  );

  return (
    <Screen>
      <OfflineBanner visible={offline} />

      {/* Liste vide + ListHeaderComponent : tout le contenu vit dans l'en-tête,
          ce qui permet d'imbriquer des carrousels horizontaux sans le
          saccadement d'un ScrollView vertical contenant des FlatList. */}
      <FlatList<never>
        data={[]}
        renderItem={() => null}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={popular.isRefetching}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: itemCount > 0 ? 96 : theme.spacing.xl }}
        ListHeaderComponent={
          <View>
            {/* --- Salutation + adresse ------------------------------------ */}
            <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.spacing.md }}>
              <Text variant="body" color="textSecondary">
                {greeting()} {firstName(profile?.full_name) || ''} 👋
              </Text>

              <Pressable
                onPress={() => router.push('/addresses')}
                noScale
                accessibilityLabel="Changer l’adresse de livraison"
                style={[styles.addressRow, { marginTop: theme.spacing.xs }]}
              >
                <MapPin size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
                <Text variant="h3" numberOfLines={1} style={{ marginHorizontal: 6, flexShrink: 1 }}>
                  {defaultAddress
                    ? `${defaultAddress.commune ?? defaultAddress.street}`
                    : 'Choisir une adresse'}
                </Text>
                <CaretRight size={14} color={theme.colors.textMuted} weight="bold" />
              </Pressable>
            </View>

            <Spacer size="base" />

            {/* --- Recherche ---------------------------------------------- */}
            <View style={{ paddingHorizontal: theme.screenPadding }}>
              <Pressable onPress={() => router.push('/(tabs)/menu')} noScale>
                <View pointerEvents="none">
                  <SearchBar value="" onChangeText={() => {}} />
                </View>
              </Pressable>
            </View>

            {/* --- Restaurant fermé --------------------------------------- */}
            {restaurant && !restaurant.is_accepting_orders ? (
              <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.spacing.base }}>
                <Surface
                  padding="base"
                  elevation={0}
                  style={{ backgroundColor: theme.colors.warningSoft, flexDirection: 'row' }}
                >
                  <Storefront size={theme.iconSize.sm} color={theme.colors.warning} weight="fill" />
                  <Text variant="label" style={{ color: theme.colors.warning, flex: 1, marginLeft: 8 }}>
                    Le restaurant ne prend pas de commande pour le moment. Vous pouvez consulter le
                    menu.
                  </Text>
                </Surface>
              </View>
            ) : null}

            {/* --- Commande en cours -------------------------------------- */}
            {activeOrder ? (
              <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.spacing.lg }}>
                <Pressable onPress={() => router.push(`/order/${activeOrder.id}`)}>
                  <Surface padding="base" elevation={2}>
                    <View style={styles.rowBetween}>
                      <Badge
                        label={orderStatusCustomerLabel[activeOrder.status]}
                        tone="info"
                        dot
                        size="sm"
                      />
                      <Text variant="caption" color="textMuted" tabular>
                        {activeOrder.order_number}
                      </Text>
                    </View>

                    <Text variant="h3" style={{ marginTop: theme.spacing.sm }}>
                      Votre commande est en route
                    </Text>
                    <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                      Arrivée estimée dans {formatEtaRange(activeOrder.eta_minutes)}
                    </Text>

                    <View style={[styles.rowBetween, { marginTop: theme.spacing.md }]}>
                      <Text variant="labelStrong" color="primary">
                        Suivre ma commande
                      </Text>
                      <CaretRight size={14} color={theme.colors.primary} weight="bold" />
                    </View>
                  </Surface>
                </Pressable>
              </View>
            ) : null}

            {/* --- Catégories --------------------------------------------- */}
            {categories && categories.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionHeader
                  title="Catégories"
                  actionLabel="Voir le menu"
                  onAction={() => router.push('/(tabs)/menu')}
                  style={{ paddingHorizontal: theme.screenPadding }}
                />
                <CategoryChips
                  categories={categories}
                  selectedId={null}
                  showAll={false}
                  onSelect={(id) =>
                    router.push({ pathname: '/(tabs)/menu', params: { category: id ?? '' } })
                  }
                />
              </View>
            ) : null}

            {/* --- Promotions --------------------------------------------- */}
            {promotions && promotions.length > 0 ? (
              <View style={{ marginTop: theme.spacing['2xl'] }}>
                <SectionHeader
                  title="Offres du moment"
                  style={{ paddingHorizontal: theme.screenPadding }}
                />
                <FlatList
                  horizontal
                  data={promotions}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: theme.screenPadding,
                    gap: theme.spacing.md,
                  }}
                  renderItem={({ item }) => <PromoCard promotion={item} />}
                />
              </View>
            ) : null}

            {/* --- Populaires --------------------------------------------- */}
            <View style={{ marginTop: theme.spacing['2xl'] }}>
              <SectionHeader
                title="Les plus commandés"
                style={{ paddingHorizontal: theme.screenPadding }}
              />

              {isLoading ? (
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                  <ListSkeleton count={2} />
                </View>
              ) : hasError ? (
                <ErrorState onRetry={refresh} />
              ) : (
                <FlatList
                  horizontal
                  data={popular.data ?? []}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: theme.screenPadding,
                    gap: theme.spacing.md,
                  }}
                  renderItem={renderProduct}
                />
              )}
            </View>

            {/* --- Recommandés -------------------------------------------- */}
            {recommended.data && recommended.data.length > 0 ? (
              <View style={{ marginTop: theme.spacing['2xl'] }}>
                <SectionHeader
                  title="Nos recommandations"
                  style={{ paddingHorizontal: theme.screenPadding }}
                />
                <FlatList
                  horizontal
                  data={recommended.data}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: theme.screenPadding,
                    gap: theme.spacing.md,
                  }}
                  renderItem={renderProduct}
                />
              </View>
            ) : null}
          </View>
        }
      />

      <CartBar
        itemCount={itemCount}
        total={subtotal}
        onPress={() => router.push('/cart')}
        formatMoney={(cents) => formatMoney(cents, restaurant?.currency)}
        bottomOffset={58}
      />
    </Screen>
  );
}

function PromoCard({ promotion }: { promotion: Promotion }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/menu')}
      accessibilityLabel={`${promotion.title}. ${promotion.description ?? ''}`}
      style={[
        styles.promo,
        { borderRadius: theme.radius.xl, backgroundColor: theme.colors.primary },
        theme.elevation[2],
      ]}
    >
      {promotion.image_url ? (
        <Image
          source={promotion.image_url}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl }]}
        />
      ) : null}

      {/* Voile sombre : sans lui, un texte blanc sur photo claire devient
          illisible — et on ne contrôle pas les photos du gérant. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(26,22,19,0.45)', borderRadius: theme.radius.xl },
        ]}
      />

      <View style={{ padding: theme.spacing.base, justifyContent: 'flex-end', flex: 1 }}>
        <Text variant="h3" style={{ color: '#FFFFFF' }} numberOfLines={1}>
          {promotion.title}
        </Text>
        {promotion.description ? (
          <Text
            variant="caption"
            style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}
            numberOfLines={2}
          >
            {promotion.description}
          </Text>
        ) : null}
        {promotion.code ? (
          <View style={{ marginTop: theme.spacing.sm, alignSelf: 'flex-start' }}>
            <Badge label={`Code ${promotion.code}`} tone="warning" size="sm" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carouselItem: { width: 190 },
  promo: { width: 280, height: 150, overflow: 'hidden' },
});
