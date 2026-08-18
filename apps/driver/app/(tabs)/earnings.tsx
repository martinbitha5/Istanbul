import { StyleSheet, View } from 'react-native';
import { Motorcycle, TrendUp } from 'phosphor-react-native';
import { formatMoney, useDriverEarnings, useDriverProfile } from '@istanbul/core';
import {
  Divider,
  ErrorState,
  Header,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';

/**
 * Revenus.
 *
 * Les montants viennent de `deliveries.payout_amount`, figé au moment de
 * l'assignation. Changer la grille tarifaire demain ne réécrit pas ce que le
 * livreur a gagné hier.
 */
export default function Earnings() {
  const theme = useTheme();
  const { data: driver } = useDriverProfile();
  const { data, isLoading, isError, refetch } = useDriverEarnings(driver?.id ?? null);

  if (isLoading) {
    return (
      <Screen>
        <Header title="Mes revenus" large />
        <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.base }}>
          <Skeleton height={140} radius={theme.radius.lg} />
          <Skeleton height={120} radius={theme.radius.lg} />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <Header title="Mes revenus" large />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const averagePerDelivery =
    data.deliveriesTotal > 0 ? Math.round(data.total / data.deliveriesTotal) : 0;

  return (
    <Screen>
      <Header title="Mes revenus" large />

      <ScreenScroll>
        {/* --- Aujourd'hui ---------------------------------------------- */}
        <Surface padding="lg" elevation={2} style={{ backgroundColor: theme.colors.primary }}>
          <Text variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Aujourd’hui
          </Text>
          <Text
            variant="brand"
            tabular
            style={{ color: '#FFFFFF', marginTop: theme.spacing.xs, fontSize: 40 }}
          >
            {formatMoney(data.today)}
          </Text>
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {data.deliveriesToday} livraison{data.deliveriesToday > 1 ? 's' : ''} effectuée
            {data.deliveriesToday > 1 ? 's' : ''}
          </Text>
        </Surface>

        <Spacer size="lg" />

        {/* --- Périodes -------------------------------------------------- */}
        <View style={styles.statRow}>
          <StatCard label="Cette semaine" value={formatMoney(data.week)} />
          <View style={{ width: theme.spacing.md }} />
          <StatCard label="Ce mois" value={formatMoney(data.month)} />
        </View>

        <Spacer size="lg" />

        {/* --- Cumul ----------------------------------------------------- */}
        <Surface padding="base" elevation={1}>
          <View style={styles.rowBetween}>
            <View style={styles.iconRow}>
              <TrendUp size={theme.iconSize.sm} color={theme.colors.success} weight="bold" />
              <Text variant="body" color="textSecondary" style={{ marginLeft: 8 }}>
                Total depuis le début
              </Text>
            </View>
            <Text variant="priceSmall" tabular>
              {formatMoney(data.total)}
            </Text>
          </View>

          <Divider spacing="md" />

          <View style={styles.rowBetween}>
            <View style={styles.iconRow}>
              <Motorcycle size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
              <Text variant="body" color="textSecondary" style={{ marginLeft: 8 }}>
                Livraisons effectuées
              </Text>
            </View>
            <Text variant="bodyStrong" tabular>
              {data.deliveriesTotal}
            </Text>
          </View>

          <Divider spacing="md" />

          <View style={styles.rowBetween}>
            <Text variant="body" color="textSecondary">
              Gain moyen par course
            </Text>
            <Text variant="bodyStrong" tabular>
              {formatMoney(averagePerDelivery)}
            </Text>
          </View>
        </Surface>

        <Spacer size="lg" />

        <Text variant="caption" color="textMuted" align="center">
          Les montants correspondent aux frais de livraison encaissés par le restaurant et versés
          selon la périodicité convenue.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Surface padding="base" elevation={1} style={{ flex: 1 }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="h1" tabular style={{ marginTop: theme.spacing.xs }}>
        {value}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
});
