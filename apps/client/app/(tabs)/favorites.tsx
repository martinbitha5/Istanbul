import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Heart } from 'phosphor-react-native';
import {
  cartItemCount,
  cartSubtotal,
  formatMoney,
  useCartStore,
  useFavoriteIds,
  useFavorites,
  useRestaurant,
  useSession,
  useToggleFavorite,
} from '@istanbul/core';
import {
  CartBar,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  ProductCard,
  Screen,
  useTheme,
} from '@istanbul/ui';
import { config } from '@/lib/config';

export default function Favorites() {
  const theme = useTheme();
  const { session } = useSession();

  const { data: favorites, isLoading, isError, refetch, isRefetching } = useFavorites();
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const { data: restaurant } = useRestaurant(config.restaurantId);

  const lines = useCartStore((state) => state.lines);
  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  if (!session) {
    return (
      <Screen>
        <Header title="Favoris" large />
        <EmptyState
          title="Connectez-vous"
          description="Enregistrez vos plats préférés pour les retrouver en un tap."
          actionLabel="Se connecter"
          onAction={() => router.push('/(auth)/sign-in')}
          icon={<Heart size={32} color={theme.colors.textMuted} weight="duotone" />}
        />
      </Screen>
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
            paddingBottom: itemCount > 0 ? 110 : theme.spacing.xl,
            gap: theme.spacing.md,
          }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              layout="row"
              onPress={() => router.push(`/product/${item.id}`)}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  productId: item.id,
                  isFavorite: favoriteIds.has(item.id),
                })
              }
              isFavorite
              formatPrice={(cents) => formatMoney(cents, restaurant?.currency)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Aucun favori"
              description="Touchez le cœur sur un plat pour le retrouver ici."
              actionLabel="Découvrir le menu"
              onAction={() => router.push('/(tabs)/menu')}
              icon={<Heart size={32} color={theme.colors.textMuted} weight="duotone" />}
            />
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
