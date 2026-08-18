import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bell,
  CreditCard,
  Info,
  MapPinLine,
  Moon,
  Phone,
  Receipt,
  SignOut,
  User as UserIcon,
} from 'phosphor-react-native';
import {
  formatPhone,
  initials,
  signOut,
  updateMyProfile,
  useProfile,
  useSession,
} from '@istanbul/core';
import {
  Avatar,
  Button,
  Divider,
  Header,
  ListRow,
  Screen,
  ScreenScroll,
  Spacer,
  Surface,
  Text,
  useTheme,
  useThemeContext,
} from '@istanbul/ui';

export default function Profile() {
  const theme = useTheme();
  const { preference, setPreference, isDark } = useThemeContext();
  const { session } = useSession();
  const { profile, refetch } = useProfile();

  if (!session || !profile) {
    return (
      <Screen>
        <Header title="Profil" large />
        <ScreenScroll>
          <Surface padding="lg" elevation={1} style={{ alignItems: 'center' }}>
            <Avatar fallback="?" size={64} />
            <Text variant="h2" align="center" style={{ marginTop: theme.spacing.base }}>
              Bienvenue chez Istanbul
            </Text>
            <Text
              variant="body"
              color="textSecondary"
              align="center"
              style={{ marginTop: theme.spacing.sm }}
            >
              Connectez-vous pour enregistrer vos adresses, suivre vos commandes et retrouver vos
              favoris.
            </Text>

            <Spacer size="xl" />

            <Button
              label="Se connecter"
              onPress={() => router.push('/(auth)/sign-in')}
              fullWidth
              size="lg"
            />
            <Spacer size="md" />
            <Button
              label="Créer un compte"
              variant="secondary"
              onPress={() => router.push('/(auth)/sign-up')}
              fullWidth
              size="lg"
            />
          </Surface>
        </ScreenScroll>
      </Screen>
    );
  }

  const toggleNotification = async (key: 'notif_orders' | 'notif_promos', value: boolean) => {
    await updateMyProfile({ [key]: value });
    void refetch();
  };

  const confirmSignOut = () => {
    Alert.alert('Se déconnecter', 'Vous devrez vous reconnecter pour commander.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: () => {
          void signOut().then(() => router.replace('/(tabs)'));
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Profil" large />

      <ScreenScroll>
        {/* --- Identité -------------------------------------------------- */}
        <Surface padding="base" elevation={1}>
          <View style={styles.identityRow}>
            <Avatar uri={profile.avatar_url} fallback={initials(profile.full_name)} size={60} />
            <View style={{ flex: 1, marginLeft: theme.spacing.base }}>
              <Text variant="h2" numberOfLines={1}>
                {profile.full_name || 'Votre nom'}
              </Text>
              {profile.phone ? (
                <Text variant="bodySmall" color="textSecondary" tabular>
                  {formatPhone(profile.phone)}
                </Text>
              ) : null}
              {profile.email ? (
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {profile.email}
                </Text>
              ) : null}
            </View>
          </View>
        </Surface>

        <Spacer size="xl" />

        {/* --- Compte ---------------------------------------------------- */}
        <Text variant="label" color="textMuted" uppercase>
          Compte
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Mes informations"
            subtitle="Nom, téléphone, photo"
            icon={<UserIcon size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => router.push('/addresses')}
          />
          <Divider />
          <ListRow
            title="Mes adresses"
            subtitle="Domicile, bureau…"
            icon={<MapPinLine size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => router.push('/addresses')}
          />
          <Divider />
          <ListRow
            title="Mes commandes"
            icon={<Receipt size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => router.push('/(tabs)/orders')}
          />
          <Divider />
          <ListRow
            title="Moyens de paiement"
            subtitle="Paiement à la livraison uniquement"
            icon={<CreditCard size={theme.iconSize.sm} color={theme.colors.text} />}
          />
        </Surface>

        <Spacer size="xl" />

        {/* --- Préférences ----------------------------------------------- */}
        <Text variant="label" color="textMuted" uppercase>
          Préférences
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Suivi de mes commandes"
            subtitle="Notifications à chaque étape"
            icon={<Bell size={theme.iconSize.sm} color={theme.colors.text} />}
            right={
              <Switch
                value={profile.notif_orders}
                onValueChange={(value) => void toggleNotification('notif_orders', value)}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                accessibilityLabel="Notifications de suivi de commande"
              />
            }
          />
          <Divider />
          <ListRow
            title="Offres et nouveautés"
            icon={<Bell size={theme.iconSize.sm} color={theme.colors.text} />}
            right={
              <Switch
                value={profile.notif_promos}
                onValueChange={(value) => void toggleNotification('notif_promos', value)}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                accessibilityLabel="Notifications promotionnelles"
              />
            }
          />
          <Divider />
          <ListRow
            title="Mode sombre"
            subtitle={preference === 'system' ? 'Suit le réglage du téléphone' : undefined}
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

        {/* --- Aide ------------------------------------------------------ */}
        <Text variant="label" color="textMuted" uppercase>
          Aide
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Appeler le restaurant"
            subtitle="+243 999 000 111"
            icon={<Phone size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => void Linking.openURL('tel:+243999000111')}
          />
          <Divider />
          <ListRow
            title="À propos"
            subtitle="Version 1.0.0"
            icon={<Info size={theme.iconSize.sm} color={theme.colors.text} />}
          />
        </Surface>

        <Spacer size="xl" />

        {/* Action destructive : séparée visuellement du reste. */}
        <Surface padding="none" elevation={1} style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Se déconnecter"
            icon={<SignOut size={theme.iconSize.sm} color={theme.colors.danger} />}
            onPress={confirmSignOut}
            destructive
          />
        </Surface>

        <Spacer size="xl" />

        <Text variant="caption" color="textMuted" align="center">
          Istanbul Fast Food · Kinshasa
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center' },
});
