import { StyleSheet, View } from 'react-native';
import { Motorcycle, TrendUp } from 'phosphor-react-native';
import { formatMoney, useDriverEarnings, useDriverProfile } from '@istanbul/core';
import {
  Divider,
  ErrorState,
  Header,
  Price,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';
import { Row } from '@/components/Row';

/**
 * Revenus.
 *
 * Les montants viennent de `deliveries.payout_amount`, figé au moment de
 * l'assignation. Changer la grille tarifaire demain ne réécrit pas ce que le
 * livreur a gagné hier.
 *
 * NOTE(devise) : `DriverEarnings` n'expose pas la devise — les montants sont
 * agrégés côté client sans elle. `formatMoney` retombe donc sur sa devise
 * par défaut ici ; exposer `currency` dans l'agrégat serait la vraie
 * correction (changement côté packages/core).
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
        {/* --- Aujourd'hui ----------------------------------------------
            `textOnPrimary` est un encre foncé en mode sombre : c'est voulu,
            le fond `primary` y est plus clair — ne jamais forcer du blanc. */}
        <Surface padding="lg" elevation={2} style={{ backgroundColor: theme.colors.primary }}>
          <Text variant="label" color="textOnPrimary" style={{ opacity: 0.85 }}>
            Aujourd’hui
          </Text>
          <Price
            variant="priceLarge"
            color="textOnPrimary"
            style={{ marginTop: theme.spacing.xs }}
          >
            {formatMoney(data.today)}
          </Price>
          <Text
            variant="body"
            color="textOnPrimary"
            style={{ opacity: 0.85, marginTop: theme.spacing.xxs }}
          >
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
          <Row>
            <View style={styles.iconRow}>
              <TrendUp size={theme.iconSize.sm} color={theme.colors.success} weight="bold" />
              <Text variant="body" color="textSecondary" style={{ marginLeft: theme.spacing.sm }}>
                Total depuis le début
              </Text>
            </View>
            <Text variant="priceSmall" tabular>
              {formatMoney(data.total)}
            </Text>
          </Row>

          <Divider spacing="md" />

          <Row>
            <View style={styles.iconRow}>
              <Motorcycle size={theme.iconSize.sm} color={theme.colors.primary} weight="fill" />
              <Text variant="body" color="textSecondary" style={{ marginLeft: theme.spacing.sm }}>
                Livraisons effectuées
              </Text>
            </View>
            <Text variant="bodyStrong" tabular>
              {data.deliveriesTotal}
            </Text>
          </Row>

          <Divider spacing="md" />

          <Row>
            <Text variant="body" color="textSecondary">
              Gain moyen par course
            </Text>
            <Text variant="bodyStrong" tabular>
              {formatMoney(averagePerDelivery)}
            </Text>
          </Row>
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
  iconRow: { flexDirection: 'row', alignItems: 'center' },
});
