import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  formatMoney,
  useCategories,
  useFavoriteIds,
  useProducts,
  useProfile,
  useRestaurant,
  useToggleFavorite,
} from '@istanbul/core';
import type { Product } from '@istanbul/types';
import {
  CategoryChips,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  NoResultsState,
  ProductCard,
  Screen,
  SearchBar,
  Spacer,
  useTheme,
} from '@istanbul/ui';
import { useRestaurantId } from '@/store/restaurant';
import { TabCartBar, useCartItemCount } from '@/components/TabCartBar';
import { useCartBarListPadding } from '@/lib/layout';

/**
 * Menu.
 *
 * Deux colonnes, filtrage par catégorie, recherche locale. La recherche
 * filtre côté client sur la liste déjà chargée : à l'échelle d'un menu de
 * fast-food (quelques dizaines de plats), un aller-retour réseau par frappe
 * serait plus lent et coûterait de la data au client.
 */
export default function Menu() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();

  const [categoryId, setCategoryId] = useState<string | null>(params.category || null);
  const [search, setSearch] = useState('');

  // L'onglet reste monté : sans cette synchronisation, taper une catégorie
  // depuis l'accueil ne changeait le filtre qu'à la toute première ouverture.
  useEffect(() => {
    if (params.category !== undefined) {
      setCategoryId(params.category || null);
    }
  }, [params.category]);

  const restaurantId = useRestaurantId();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: categories } = useCategories(restaurantId);
  const { profile } = useProfile();

  const productsQuery = useProducts(restaurantId, { categoryId, limit: 200 });
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const toggleFavoriteMutate = toggleFavorite.mutate;

  const itemCount = useCartItemCount();
  const listBottomPadding = useCartBarListPadding(itemCount > 0);

  const products = useMemo(() => {
    const all = productsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;

    return all.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.tags.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [productsQuery.data, search]);

  // La cascade d'entrée ne joue qu'au premier affichage : appliquée dans le
  // renderItem, elle se rejouait à chaque recyclage de cellule pendant le
  // défilement — un scintillement permanent sur les longues listes.
  const hasAnimatedRef = useRef(false);
  useEffect(() => {
    if (!productsQuery.isLoading && products.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [productsQuery.isLoading, products.length]);

  const currency = restaurant?.currency;
  const isSignedIn = Boolean(profile);

  const renderItem = useCallback<ListRenderItem<Product>>(
    ({ item, index }) => (
      <Animated.View
        entering={
          hasAnimatedRef.current
            ? undefined
            : FadeInDown.delay(theme.stagger.delayFor(index)).duration(theme.duration.base)
        }
        style={styles.gridItem}
      >
        <ProductCard
          product={item}
          layout="grid"
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
      <Header title="Notre menu" large />

      <View style={{ paddingHorizontal: theme.screenPadding }}>
        <SearchBar value={search} onChangeText={setSearch} autoFocus={params.focus === '1'} />
      </View>

      <Spacer size="base" />

      {categories && categories.length > 0 ? (
        <CategoryChips
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
        />
      ) : null}

      <Spacer size="base" />

      {productsQuery.isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={3} />
        </View>
      ) : productsQuery.isError ? (
        <ErrorState onRetry={() => void productsQuery.refetch()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: theme.spacing.md }}
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding,
            paddingBottom: listBottomPadding,
            gap: theme.spacing.md,
          }}
          renderItem={renderItem}
          // Rend le défilement fluide sur les téléphones d'entrée de gamme.
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            search.trim() ? (
              <NoResultsState query={search} onReset={() => setSearch('')} />
            ) : (
              <EmptyState
                title="Aucun plat dans cette catégorie"
                description="Choisissez une autre catégorie pour découvrir notre menu."
                actionLabel="Voir tout"
                onAction={() => setCategoryId(null)}
              />
            )
          }
        />
      )}

      <TabCartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridItem: { flex: 1 },
});
