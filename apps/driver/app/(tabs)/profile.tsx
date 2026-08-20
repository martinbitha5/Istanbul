import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { IdentificationCard, Info, Moon, Phone, SignOut, Star } from 'phosphor-react-native';
import {
  driverAvailabilityLabel,
  formatPhone,
  initials,
  signOut,
  useDriverProfile,
  useProfile,
  vehicleLabel,
} from '@istanbul/core';
import {
  Avatar,
  Badge,
  Divider,
  Header,
  ListRow,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
  useThemeContext,
} from '@istanbul/ui';
import { RESTAURANT } from '@/lib/restaurant';

export default function DriverProfile() {
  const theme = useTheme();
  const { isDark, setPreference } = useThemeContext();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: driver, isLoading: driverLoading } = useDriverProfile();

  const rating =
    driver && driver.rating_count > 0
      ? (driver.rating_sum / driver.rating_count).toFixed(1).replace('.', ',')
      : null;

  const confirmSignOut = () => {
    Alert.alert(
      'Se déconnecter',
      'Vous ne recevrez plus de course tant que vous n’êtes pas reconnecté.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          // Même pattern que `app/index.tsx` : signOut puis retour au
          // portier, qui redirige vers la connexion.
          onPress: () => void signOut().then(() => router.replace('/')),
        },
      ],
    );
  };

  return (
    <Screen>
      <Header title="Profil" large />

      <ScreenScroll>
        <Surface padding="base" elevation={1}>
          <View style={styles.identityRow}>
            <Avatar
              uri={profile?.avatar_url}
              fallback={initials(profile?.full_name)}
              size={60}
            />

            <View style={{ flex: 1, marginLeft: theme.spacing.base }}>
              {/* Skeleton pendant le chargement : afficher « Livreur » comme
                  si c'était le vrai nom fait douter d'être sur le bon compte. */}
              {profileLoading ? (
                <Skeleton width={160} height={22} />
              ) : (
                <Text variant="h2" numberOfLines={1}>
                  {profile?.full_name ?? 'Livreur'}
                </Text>
              )}
              {profile?.phone ? (
                <Text variant="bodySmall" color="textSecondary" tabular>
                  {formatPhone(profile.phone)}
                </Text>
              ) : null}

              <View
                style={[styles.badgeRow, { gap: theme.spacing.sm, marginTop: theme.spacing.xs }]}
              >
                {driver ? (
                  <Badge
                    label={driverAvailabilityLabel[driver.availability]}
                    tone={driver.availability === 'AVAILABLE' ? 'success' : 'neutral'}
                    size="sm"
                    dot
                  />
                ) : null}
                {rating ? (
                  <Badge
                    label={rating}
                    tone="warning"
                    size="sm"
                    icon={<Star size={theme.iconSize.xs} color={theme.colors.warning} weight="fill" />}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Surface>

        <Spacer size="xl" />

        <Text variant="label" color="textMuted" uppercase>
          Véhicule
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          {driverLoading ? (
            <View style={{ paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}>
              <Skeleton width={140} height={18} />
              <Skeleton width={100} height={14} />
            </View>
          ) : (
            <ListRow
              title={driver ? vehicleLabel[driver.vehicle] : '—'}
              subtitle={driver?.plate_number ?? 'Plaque non renseignée'}
              icon={<IdentificationCard size={theme.iconSize.sm} color={theme.colors.text} />}
            />
          )}
          <Divider />
          <ListRow
            title="Livraisons effectuées"
            icon={<Star size={theme.iconSize.sm} color={theme.colors.text} />}
            right={
              <Text variant="bodyStrong" tabular>
                {driver?.total_deliveries ?? 0}
              </Text>
            }
          />
        </Surface>

        <Spacer size="xl" />

        <Text variant="label" color="textMuted" uppercase>
          Préférences
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Mode sombre"
            subtitle="Plus lisible la nuit, moins de batterie"
            icon={<Moon size={theme.iconSize.sm} color={theme.colors.text} />}
            right={
              <Switch
                value={isDark}
                onValueChange={(value) => setPreference(value ? 'dark' : 'light')}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                accessibilityLabel="Mode sombre"
              />
            }
          />
        </Surface>

        <Spacer size="xl" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Appeler le restaurant"
            subtitle={RESTAURANT.phoneDisplay}
            icon={<Phone size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => void Linking.openURL(`tel:${RESTAURANT.phone}`)}
          />
          <Divider />
          <ListRow
            title="À propos"
            subtitle="Istanbul Livreur · Version 1.0.0"
            icon={<Info size={theme.iconSize.sm} color={theme.colors.text} />}
          />
        </Surface>

        <Spacer size="xl" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Se déconnecter"
            icon={<SignOut size={theme.iconSize.sm} color={theme.colors.danger} />}
            onPress={confirmSignOut}
            destructive
          />
        </Surface>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  badgeRow: { flexDirection: 'row' },
});
