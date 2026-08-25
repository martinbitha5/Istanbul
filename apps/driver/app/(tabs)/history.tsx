import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { ClockCounterClockwise } from 'phosphor-react-native';
import {
  formatDateTime,
  formatMoney,
  useCompletedDeliveries,
  useDriverProfile,
} from '@istanbul/core';
import {
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  Pressable,
  Screen,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { Row } from '@/components/Row';
import { useTabBarPadding } from '@/lib/layout';

export default function History() {
  const theme = useTheme();
  const tabBarPadding = useTabBarPadding();
  const { data: driver } = useDriverProfile();
  const { data, isLoading, isError, refetch, isRefetching } = useCompletedDeliveries(
    driver?.id ?? null,
  );

  return (
    <Screen>
      <Header title="Historique" large />

      {isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={4} />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding,
            paddingBottom: tabBarPadding,
            gap: theme.spacing.md,
          }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/delivery/${item.id}`)}>
              <Surface padding="base" elevation={0} bordered>
                <Row>
                  <Text variant="labelStrong" tabular color="textSecondary">
                    {item.order.order_number}
                  </Text>
                  <Badge label="Livrée" tone="success" size="sm" dot />
                </Row>

                <Text variant="body" numberOfLines={1} style={{ marginTop: theme.spacing.sm }}>
                  {item.order.contact_name}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.order.delivery_commune ?? item.order.delivery_address}
                </Text>

                <Divider spacing="md" />

                <Row>
                  <Text variant="caption" color="textMuted">
                    {formatDateTime(item.delivered_at)}
                  </Text>
                  {/* `success` reste le bon token : son contraste a été
                      corrigé côté tokens, pas de couleur locale ici. */}
                  <Text variant="priceSmall" tabular color="success">
                    +{formatMoney(item.payout_amount, item.order.currency)}
                  </Text>
                </Row>
              </Surface>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Aucune livraison terminée"
              description="Vos courses livrées apparaîtront ici avec vos gains."
              icon={
                <ClockCounterClockwise
                  size={theme.iconSize.xl}
                  color={theme.colors.textMuted}
                  weight="duotone"
                />
              }
            />
          }
        />
      )}
    </Screen>
  );
}

