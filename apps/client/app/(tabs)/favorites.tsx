import { useCallback } from 'react';
import { FlatList, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { Heart } from 'phosphor-react-native';
import {
  formatMoney,
  useFavoriteIds,
  useFavorites,
  useRestaurant,
  useSession,
  useToggleFavorite,
} from '@istanbul/core';
import type { Product } from '@istanbul/types';
import {
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  ProductCard,
  Screen,
  useTheme,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';
import { AuthGate } from '@/components/AuthGate';
import { TabCartBar, useCartItemCount } from '@/components/TabCartBar';
import { useCartBarListPadding } from '@/lib/layout';

export default function Favorites() {
  const theme = useTheme();
  const { session, isLoading: sessionLoading } = useSession();

  const { data: favorites, isLoading, isError, refetch, isRefetching } = useFavorites();
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const toggleFavoriteMutate = toggleFavorite.mutate;
  const { data: restaurant } = useRestaurant(restaurantId);

  const itemCount = useCartItemCount();
  const listBottomPadding = useCartBarListPadding(itemCount > 0);

  const currency = restaurant?.currency;

  const renderItem = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <ProductCard
        product={item}
        layout="row"
        onPress={() => router.push(`/product/${item.id}`)}
        onToggleFavorite={() =>
          toggleFavoriteMutate({
            productId: item.id,
            isFavorite: favoriteIds.has(item.id),
          })
        }
        isFavorite
        formatPrice={(cents) => formatMoney(cents, currency)}
      />
    ),
    [toggleFavoriteMutate, favoriteIds, currency],
  );

  if (sessionLoading || !session) {
    return (
      <AuthGate
        title="Favoris"
        description="Enregistrez vos plats préférés pour les retrouver en un tap."
        icon={<Heart size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
      />
    );
  }

  return (
    <Screen>
      <Header title="Favoris" large />

      {isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={3} />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={favorites ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding,
            paddingBottom: listBottomPadding,
            gap: theme.spacing.md,
          }}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              title="Aucun favori"
              description="Touchez le cœur sur un plat pour le retrouver ici."
              actionLabel="Découvrir le menu"
              onAction={() => router.push('/(tabs)/menu')}
              icon={<Heart size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
            />
          }
        />
      )}

      <TabCartBar />
    </Screen>
  );
}
