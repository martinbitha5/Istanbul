import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  CaretDown,
  CaretRight,
  Check,
  MagnifyingGlass,
  MapPin,
  Storefront,
} from 'phosphor-react-native';
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
  useRestaurants,
  useToggleFavorite,
} from '@istanbul/core';
import type { Address, Category, OrderDetail, Product, Promotion, Restaurant } from '@istanbul/types';
import {
  Badge,
  CategoryChips,
  EmptyState,
  ErrorState,
  ListRow,
  ListSkeleton,
  Pressable,
  ProductCard,
  Screen,
  SectionHeader,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { useRestaurantId, useRestaurantStore } from '@/store/restaurant';
import { TabCartBar, useCartItemCount } from '@/components/TabCartBar';
import { useCartBarListPadding } from '@/lib/layout';

/**
 * Accueil.
 *
 * Salutation, adresse, recherche, catégories, promotions, populaires,
 * recommandés, et le bandeau de commande en cours quand il y en a une.
 * Le bandeau hors ligne vit dans le layout des onglets — pas ici.
 */
export default function Home() {
  const theme = useTheme();

  const { profile } = useProfile();
  const restaurantId = useRestaurantId();
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
            tintColor={theme.colors.primary}
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
      {/* --- Salutation + adresse ------------------------------------ */}
      <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.spacing.md }}>
        <Text variant="body" color="textSecondary">
          {greeting()} {firstName(profileFullName ?? undefined) || ''} 👋
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
          <CaretRight size={theme.iconSize.xs} color={theme.colors.textMuted} weight="bold" />
        </Pressable>

        {/* Sélecteur multi-restaurants — invisible tant qu'il n'y a
            qu'un seul point de vente. */}
        <RestaurantPicker />
      </View>

      <Spacer size="base" />

      {/* --- Recherche ----------------------------------------------
          Pas de vrai TextInput ici : un champ inerte dans un Pressable
          piégeait le focus des lecteurs d'écran. C'est un bouton habillé
          en barre de recherche, qui ouvre le menu avec le clavier prêt. */}
      <View style={{ paddingHorizontal: theme.screenPadding }}>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/menu', params: { focus: '1' } })}
          noScale
          accessibilityRole="search"
          accessibilityLabel="Rechercher un plat"
          style={[
            styles.searchFacade,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.base,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MagnifyingGlass size={theme.iconSize.sm} color={theme.colors.textMuted} />
          <Text variant="body" color="textMuted" style={{ marginLeft: 10 }}>
            Rechercher un plat…
          </Text>
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
          <Pressable
            onPress={() => router.push(`/order/${activeOrder.id}`)}
            accessibilityLabel={`Commande ${activeOrder.order_number}, ${
              orderStatusCustomerLabel[activeOrder.status]
            }. Suivre ma commande`}
          >
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
                <CaretRight size={theme.iconSize.xs} color={theme.colors.primary} weight="bold" />
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
            contentContainerStyle={carouselContent}
            renderItem={({ item }) => <PromoCard promotion={item} />}
          />
        </View>
      ) : null}

      {/* --- Populaires ----------------------------------------------
          Chaque section gère SES états : une erreur ici ne doit pas
          éteindre les recommandations, et inversement. */}
      <View style={{ marginTop: theme.spacing['2xl'] }}>
        <SectionHeader
          title="Les plus commandés"
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
        <View style={{ marginTop: theme.spacing['2xl'] }}>
          <SectionHeader
            title="Nos recommandations"
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

/**
 * Sélecteur de restaurant.
 *
 * N'apparaît que si la base contient plusieurs restaurants : le jour où un
 * deuxième point de vente ouvre, il se matérialise sans mise à jour de l'app.
 * Changer de restaurant vide le panier (produits et prix n'existent pas
 * ailleurs) — le store s'en charge.
 */
function RestaurantPicker() {
  const theme = useTheme();
  const restaurantId = useRestaurantStore((state) => state.restaurantId);
  const setRestaurantId = useRestaurantStore((state) => state.setRestaurantId);
  const { data: restaurants } = useRestaurants();
  const [open, setOpen] = useState(false);

  if (!restaurants || restaurants.length < 2) return null;

  const current = restaurants.find((candidate) => candidate.id === restaurantId);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        noScale
        accessibilityLabel="Changer de restaurant"
        style={[styles.addressRow, { marginTop: theme.spacing.xs }]}
      >
        <Storefront size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
        <Text variant="label" color="textSecondary" numberOfLines={1} style={{ marginHorizontal: 6 }}>
          {current?.name ?? 'Choisir un restaurant'}
        </Text>
        <CaretDown size={theme.iconSize.xs} color={theme.colors.textMuted} weight="bold" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          noScale
          style={[
            styles.pickerBackdrop,
            { padding: theme.screenPadding, backgroundColor: theme.colors.overlay },
          ]}
        >
          <Surface padding="none" elevation={3} style={{ paddingHorizontal: theme.spacing.base }}>
            {restaurants.map((restaurant) => (
              <ListRow
                key={restaurant.id}
                title={restaurant.name}
                subtitle={restaurant.address_line}
                icon={
                  <Storefront
                    size={theme.iconSize.sm}
                    color={
                      restaurant.id === restaurantId
                        ? theme.colors.primary
                        : theme.colors.textMuted
                    }
                    weight={restaurant.id === restaurantId ? 'fill' : 'regular'}
                  />
                }
                right={
                  restaurant.id === restaurantId ? (
                    <Check size={theme.iconSize.sm} color={theme.colors.primary} weight="bold" />
                  ) : undefined
                }
                onPress={() => {
                  setRestaurantId(restaurant.id);
                  setOpen(false);
                }}
              />
            ))}
          </Surface>
        </Pressable>
      </Modal>
    </>
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

      {/* Voile sombre : sans lui, un texte clair sur photo claire devient
          illisible — et on ne contrôle pas les photos du gérant. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.overlay, borderRadius: theme.radius.xl },
        ]}
      />

      <View style={{ padding: theme.spacing.base, justifyContent: 'flex-end', flex: 1 }}>
        {/* `textOnScrim`, pas `textOnPrimary` : le voile photo reste sombre
            dans les deux thèmes, le texte doit rester clair. */}
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
  searchFacade: { flexDirection: 'row', alignItems: 'center', height: 48 },
  pickerBackdrop: { flex: 1, justifyContent: 'center' },
});
