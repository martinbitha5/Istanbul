import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  Bell,
  CreditCard,
  Info,
  Coins,
  MapPinLine,
  Moon,
  Phone,
  Receipt,
  SignOut,
} from 'phosphor-react-native';
import {
  formatPhone,
  initials,
  signOut,
  toUserMessage,
  updateMyProfile,
  useProfile,
  useRestaurant,
  useSession,
} from '@istanbul/core';
import {
  Avatar,
  Button,
  Divider,
  Header,
  IconBubble,
  ListRow,
  Screen,
  ScreenScroll,
  Skeleton,
  Spacer,
  Surface,
  Text,
  useTheme,
  useToast,
} from '@istanbul/ui';
import { RESTAURANT_ID as restaurantId } from '@/lib/restaurant';
import { FALLBACK_RESTAURANT_PHONE } from '@/lib/config';
import { useCartBarListPadding } from '@/lib/layout';

export default function Profile() {
  const theme = useTheme();
  const toast = useToast();
  // La barre d'onglets flotte au-dessus du contenu : sans cette réserve, le
  // bouton « Se déconnecter » finit sous les pastilles.
  const listBottomPadding = useCartBarListPadding(false);
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading, refetch } = useProfile();
  const { data: restaurant } = useRestaurant(restaurantId);

  // Le numéro vient de la fiche restaurant (multi-restaurant compatible) ;
  // le fallback centralisé ne sert qu'avant le premier chargement.
  const restaurantPhone = restaurant?.phone || FALLBACK_RESTAURANT_PHONE;
  const appVersion = Constants.expoConfig?.version ?? '—';

  // Session ou profil en cours de restauration : un squelette, jamais le
  // panneau « Connectez-vous » flashé à un utilisateur déjà connecté.
  if (sessionLoading || (session && profileLoading)) {
    return (
      <Screen>
        <Header title="Profil" large />
        <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.base }}>
          <Skeleton height={92} radius={theme.radius.lg} />
          <Skeleton height={72} radius={theme.radius.lg} />
          <Skeleton height={180} radius={theme.radius.lg} />
        </View>
      </Screen>
    );
  }

  if (!session || !profile) {
    return (
      <Screen>
        <Header title="Profil" large />
        <ScreenScroll bottomInset={listBottomPadding}>
          <Surface padding="lg" elevation={0} bordered style={{ alignItems: 'center' }}>
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
    // Sans try/catch, un échec réseau laissait un rejet non géré et un
    // interrupteur menteur : l'utilisateur croyait sa préférence enregistrée.
    try {
      await updateMyProfile({ [key]: value });
    } catch (caught) {
      toast.error(toUserMessage(caught));
    } finally {
      // Refetch dans tous les cas : il réaligne l'interrupteur sur le serveur.
      void refetch();
    }
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

      <ScreenScroll bottomInset={listBottomPadding}>
        {/* --- Identité -------------------------------------------------- */}
        <Surface padding="base" elevation={0} bordered>
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

        {/* --- Fidélité --------------------------------------------------- */}
        <Spacer size="base" />
        <Surface
          padding="base"
          elevation={0} bordered
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <IconBubble size={44} tone="warning">
            <Coins size={theme.iconSize.md} color={theme.colors.warning} weight="fill" />
          </IconBubble>
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Text variant="h3" tabular>
              {profile.loyalty_points ?? 0} points fidélité
            </Text>
            <Text variant="caption" color="textSecondary">
              1 $ commandé = 1 point · 20 points = 1 $ offert au checkout
            </Text>
          </View>
        </Surface>

        <Spacer size="xl" />

        {/* --- Compte ---------------------------------------------------- */}
        <Text variant="label" color="textMuted" uppercase>
          Compte
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={0} bordered style={{ paddingHorizontal: theme.spacing.base }}>
          {/* L'ancienne ligne « Mes informations » promettait un écran
              d'édition qui n'existe pas et menait ici aussi : une seule
              ligne honnête vaut mieux que deux libellés pour la même route. */}
          <ListRow
            title="Mes adresses"
            subtitle="Domicile, bureau… et adresse par défaut"
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

        <Surface padding="none" elevation={0} bordered style={{ paddingHorizontal: theme.spacing.base }}>
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
        </Surface>

        <Spacer size="xl" />

        {/* --- Aide ------------------------------------------------------ */}
        <Text variant="label" color="textMuted" uppercase>
          Aide
        </Text>
        <Spacer size="sm" />

        <Surface padding="none" elevation={0} bordered style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Appeler le restaurant"
            subtitle={formatPhone(restaurantPhone)}
            icon={<Phone size={theme.iconSize.sm} color={theme.colors.text} />}
            onPress={() => void Linking.openURL(`tel:${restaurantPhone}`)}
          />
          <Divider />
          <ListRow
            title="À propos"
            subtitle={`Version ${appVersion}`}
            icon={<Info size={theme.iconSize.sm} color={theme.colors.text} />}
          />
        </Surface>

        <Spacer size="xl" />

        {/* Action destructive : séparée visuellement du reste. */}
        <Surface padding="none" elevation={0} bordered style={{ paddingHorizontal: theme.spacing.base }}>
          <ListRow
            title="Se déconnecter"
            icon={<SignOut size={theme.iconSize.sm} color={theme.colors.danger} />}
            onPress={confirmSignOut}
            destructive
          />
        </Surface>

        <Spacer size="xl" />

        <Text variant="caption" color="textMuted" align="center">
          {restaurant?.name ?? 'Istanbul Fast Food'} · {restaurant?.city ?? 'Kinshasa'}
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center' },
});
