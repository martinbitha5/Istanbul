import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  cartItemCount,
  cartSubtotal,
  formatMoney,
  useCartStore,
  useCategories,
  useFavoriteIds,
  useProducts,
  useProfile,
  useRestaurant,
  useToggleFavorite,
} from '@istanbul/core';
import type { Product } from '@istanbul/types';
import {
  CartBar,
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
import { config } from '@/lib/config';

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
  const params = useLocalSearchParams<{ category?: string }>();

  const [categoryId, setCategoryId] = useState<string | null>(params.category || null);
  const [search, setSearch] = useState('');

  const { data: restaurant } = useRestaurant(config.restaurantId);
  const { data: categories } = useCategories(config.restaurantId);
  const { profile } = useProfile();

  const productsQuery = useProducts(config.restaurantId, { categoryId, limit: 200 });
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const lines = useCartStore((state) => state.lines);
  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

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

  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(theme.duration.base)}
      style={styles.gridItem}
    >
      <ProductCard
        product={item}
        layout="grid"
        onPress={() => router.push(`/product/${item.id}`)}
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
      <Header title="Notre menu" large />

      <View style={{ paddingHorizontal: theme.screenPadding }}>
        <SearchBar value={search} onChangeText={setSearch} />
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
            paddingBottom: itemCount > 0 ? 110 : theme.spacing.xl,
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

const styles = StyleSheet.create({
  gridItem: { flex: 1 },
});
