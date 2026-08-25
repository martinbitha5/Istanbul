import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bell, CaretDown, CaretRight, Storefront } from 'phosphor-react-native';
import {
  firstName,
  formatEtaRange,
  formatMoney,
  greeting,
  orderStatusCustomerLabel,
  useActiveOrder,
  useAddresses,
  useCategories,
  useFavoriteIds,
  useProducts,
  useProfile,
  usePromotions,
  useRestaurant,
  useToggleFavorite,
} from '@istanbul/core';
import type { Address, Category, OrderDetail, Product, Promotion, Restaurant } from '@istanbul/types';
import {
  Badge,
  CategoryRail,
  EmptyState,
  ErrorState,
  InlineAlert,
  ListSkeleton,
  Pressable,
  ProductCard,
  Screen,
  SectionHeader,
  Spacer,
  Text,
  useTheme,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';
import { TabCartBar, useCartItemCount } from '@/components/TabCartBar';
import { useCartBarListPadding } from '@/lib/layout';

/**
 * Accueil.
 *
 * Structure reprise du fil de la référence : adresse et cloche en tête, rail
 * de catégories, puis des sections de produits séparées par rien d'autre que
 * du blanc.
 *
 * Il n'y a plus de champ de recherche dans le corps de la page : la recherche
 * est la pilule centrale de la barre d'onglets, visible sur les cinq écrans et
 * atteignable sans remonter en haut d'une liste. En garder un second ici
 * poserait deux entrées pour la même action, dont une seule suit le
 * défilement.
 */
export default function Home() {
  const theme = useTheme();

  const { profile } = useProfile();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: categories } = useCategories(restaurantId);
  const { data: promotions } = usePromotions(restaurantId);
  const { data: addresses } = useAddresses();
  const { data: activeOrder } = useActiveOrder();

  const popular = useProducts(restaurantId, { popularOnly: true, limit: 8 });
  const recommended = useProducts(restaurantId, { recommendedOnly: true, limit: 8 });

  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const toggleFavoriteMutate = toggleFavorite.mutate;

  const itemCount = useCartItemCount();
  const listBottomPadding = useCartBarListPadding(itemCount > 0);

  const defaultAddress = useMemo(
    () => addresses?.find((address) => address.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );

  const refresh = useCallback(() => {
    void popular.refetch();
    void recommended.refetch();
  }, [popular, recommended]);

  const retryPopular = useCallback(() => void popular.refetch(), [popular]);
  const retryRecommended = useCallback(() => void recommended.refetch(), [recommended]);

  const currency = restaurant?.currency;
  const isSignedIn = Boolean(profile);

  // Mémoïsé : les carrousels le passent tel quel à leurs FlatList — un
  // renderItem recréé à chaque rendu invaliderait toutes les cellules.
  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item, index }) => (
      <Animated.View
        entering={FadeInDown.delay(theme.stagger.delayFor(index)).duration(theme.duration.base)}
        style={styles.carouselItem}
      >
        <ProductCard
          product={item}
          onPress={() => router.push(`/product/${item.id}`)}
          onToggleFavorite={
            isSignedIn
              ? () =>
                  toggleFavoriteMutate({
                    productId: item.id,
                    isFavorite: favoriteIds.has(item.id),
                  })
              : undefined
          }
          isFavorite={favoriteIds.has(item.id)}
          formatPrice={(cents) => formatMoney(cents, currency)}
        />
      </Animated.View>
    ),
    [theme, isSignedIn, toggleFavoriteMutate, favoriteIds, currency],
  );

  return (
    <Screen>
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
            tintColor={theme.colors.text}
          />
        }
        contentContainerStyle={{ paddingBottom: listBottomPadding }}
        ListHeaderComponent={
          <HomeHeader
            profileFullName={profile?.full_name ?? null}
            defaultAddress={defaultAddress}
            restaurant={restaurant ?? null}
            activeOrder={activeOrder ?? null}
            categories={categories ?? null}
            promotions={promotions ?? null}
            popularData={popular.data ?? null}
            popularLoading={popular.isLoading}
            popularError={popular.isError}
            recommendedData={recommended.data ?? null}
            recommendedError={recommended.isError}
            onRetryPopular={retryPopular}
            onRetryRecommended={retryRecommended}
            renderProduct={renderProduct}
          />
        }
      />

      <TabCartBar />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// En-tête de liste
// ---------------------------------------------------------------------------

interface HomeHeaderProps {
  profileFullName: string | null;
  defaultAddress: Address | null;
  restaurant: Restaurant | null;
  activeOrder: OrderDetail | null;
  categories: Category[] | null;
  promotions: Promotion[] | null;
  popularData: Product[] | null;
  popularLoading: boolean;
  popularError: boolean;
  recommendedData: Product[] | null;
  recommendedError: boolean;
  onRetryPopular: () => void;
  onRetryRecommended: () => void;
  renderProduct: ListRenderItem<Product>;
}

/**
 * Tout le contenu de l'accueil, extrait de l'inline `ListHeaderComponent`.
 * Inline, ces ~180 lignes étaient recréées à chaque rendu de `Home` (chaque
 * frappe du panier, chaque tick de requête) et démontaient les carrousels.
 * `React.memo` + props stables = re-rendu seulement quand une donnée change.
 */
const HomeHeader = React.memo(function HomeHeader({
  profileFullName,
  defaultAddress,
  restaurant,
  activeOrder,
  categories,
  promotions,
  popularData,
  popularLoading,
  popularError,
  recommendedData,
  recommendedError,
  onRetryPopular,
  onRetryRecommended,
  renderProduct,
}: HomeHeaderProps) {
  const theme = useTheme();

  const carouselContent = {
    paddingHorizontal: theme.screenPadding,
    gap: theme.spacing.md,
  } as const;

  return (
    <View>
      {/* --- Adresse + notifications ---------------------------------
          L'adresse est le titre de l'écran, pas une ligne de réglage : chez
          Uber elle occupe le coin haut gauche en gras, parce que c'est la
          variable qui change tout ce qui est affiché en dessous. */}
      <View
        style={[
          styles.topBar,
          { paddingHorizontal: theme.screenPadding, paddingVertical: theme.spacing.sm },
        ]}
      >
        <Pressable
          onPress={() => router.push('/addresses')}
          noScale
          accessibilityLabel="Changer l’adresse de livraison"
          style={styles.addressRow}
        >
          <Text variant="h2" numberOfLines={1} style={{ flexShrink: 1 }}>
            {defaultAddress
              ? (defaultAddress.commune ?? defaultAddress.street)
              : 'Choisir une adresse'}
          </Text>
          <CaretDown
            size={theme.iconSize.sm}
            color={theme.colors.text}
            weight="bold"
            style={{ marginLeft: 4 }}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)/orders')}
          noScale
          hitSlop={10}
          accessibilityLabel="Mes commandes"
        >
          <Bell size={theme.iconSize.md} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* Salutation reléguée sous l'adresse : agréable, mais ce n'est pas
          l'information qui fait agir. */}
      <View style={{ paddingHorizontal: theme.screenPadding }}>
        <Text variant="bodySmall" color="textSecondary">
          {greeting()} {firstName(profileFullName ?? undefined) || ''}
        </Text>
      </View>

      {/* --- Restaurant fermé --------------------------------------- */}
      {restaurant && !restaurant.is_accepting_orders ? (
        <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.spacing.base }}>
          <InlineAlert
            tone="warning"
            message="Le restaurant ne prend pas de commande pour le moment. Vous pouvez consulter le menu."
          />
        </View>
      ) : null}

      {/* --- Commande en cours --------------------------------------
          Encadré, pas ombré : une carte bordée suffit à la détacher du fond
          blanc, et l'ombre aurait fait flotter le seul bloc de la page qui
          reste au même endroit. */}
      {activeOrder ? (
        <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.spacing.base }}>
          <Pressable
            onPress={() => router.push(`/order/${activeOrder.id}`)}
            accessibilityLabel={`Commande ${activeOrder.order_number}, ${
              orderStatusCustomerLabel[activeOrder.status]
            }. Suivre ma commande`}
            style={[
              styles.activeOrder,
              {
                borderRadius: theme.radius.md,
                borderWidth: theme.borderWidth.hairline,
                borderColor: theme.colors.border,
                padding: theme.spacing.base,
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <Badge
                label={orderStatusCustomerLabel[activeOrder.status]}
                tone="success"
                variant="solid"
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
              <Text variant="labelStrong" style={{ textDecorationLine: 'underline' }}>
                Suivre ma commande
              </Text>
              <CaretRight size={theme.iconSize.xs} color={theme.colors.text} weight="bold" />
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* --- Rail de catégories -------------------------------------- */}
      {categories && categories.length > 0 ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <CategoryRail
            categories={categories}
            onSelect={(id) => router.push({ pathname: '/(tabs)/menu', params: { category: id } })}
          />
        </View>
      ) : null}

      {/* --- Promotions --------------------------------------------- */}
      {promotions && promotions.length > 0 ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionHeader
            title="Offres du moment"
            onAction={() => router.push('/(tabs)/menu')}
            style={{ paddingHorizontal: theme.screenPadding }}
          />
          <FlatList
            horizontal
            data={promotions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={carouselContent}
            renderItem={({ item }) => <PromoCard promotion={item} />}
          />
        </View>
      ) : null}

      {/* --- Populaires ----------------------------------------------
          Chaque section gère SES états : une erreur ici ne doit pas
          éteindre les recommandations, et inversement. */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <SectionHeader
          title="Les plus commandés"
          onAction={() => router.push('/(tabs)/menu')}
          style={{ paddingHorizontal: theme.screenPadding }}
        />

        {popularLoading ? (
          <View style={{ paddingHorizontal: theme.screenPadding }}>
            <ListSkeleton count={2} />
          </View>
        ) : popularError ? (
          <ErrorState onRetry={onRetryPopular} />
        ) : (popularData?.length ?? 0) === 0 ? (
          <EmptyState
            title="Rien à afficher pour l’instant"
            description="Les plats les plus commandés apparaîtront ici très bientôt."
            actionLabel="Voir le menu"
            onAction={() => router.push('/(tabs)/menu')}
            icon={<Storefront size={48} color={theme.colors.textMuted} weight="duotone" />}
          />
        ) : (
          <FlatList
            horizontal
            data={popularData ?? []}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={carouselContent}
            renderItem={renderProduct}
          />
        )}
      </View>

      {/* --- Recommandés -------------------------------------------- */}
      {recommendedError || (recommendedData && recommendedData.length > 0) ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionHeader
            title="Nos recommandations"
            onAction={() => router.push('/(tabs)/menu')}
            style={{ paddingHorizontal: theme.screenPadding }}
          />
          {recommendedError ? (
            <ErrorState onRetry={onRetryRecommended} />
          ) : (
            <FlatList
              horizontal
              data={recommendedData ?? []}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={carouselContent}
              renderItem={renderProduct}
            />
          )}
        </View>
      ) : null}
    </View>
  );
});

function PromoCard({ promotion }: { promotion: Promotion }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/menu')}
      accessibilityLabel={`${promotion.title}. ${promotion.description ?? ''}`}
      style={[styles.promo, { borderRadius: theme.radius.md, backgroundColor: theme.colors.skeleton }]}
    >
      {promotion.image_url ? (
        <Image
          source={promotion.image_url}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.md }]}
        />
      ) : null}

      {/* Voile sombre : sans lui, un texte clair sur photo claire devient
          illisible — et on ne contrôle pas les photos du gérant. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.overlay, borderRadius: theme.radius.md },
        ]}
      />

      <View style={{ padding: theme.spacing.base, justifyContent: 'flex-end', flex: 1 }}>
        {promotion.code ? (
          <View style={{ marginBottom: theme.spacing.sm, alignSelf: 'flex-start' }}>
            <Badge label={`Code ${promotion.code}`} tone="success" variant="solid" size="sm" />
          </View>
        ) : null}

        {/* `textOnScrim`, pas `textOnPrimary` : le voile photo reste sombre,
            le texte doit rester clair quoi qu'il arrive au thème. */}
        <Text variant="h3" style={{ color: theme.colors.textOnScrim }} numberOfLines={1}>
          {promotion.title}
        </Text>
        {promotion.description ? (
          <Text
            variant="caption"
            style={{ color: theme.colors.textOnScrim, opacity: 0.9, marginTop: 2 }}
            numberOfLines={2}
          >
            {promotion.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addressRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeOrder: { overflow: 'hidden' },
  carouselItem: { width: 220 },
  promo: { width: 280, height: 150, overflow: 'hidden' },
});
