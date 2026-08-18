import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Motorcycle } from 'phosphor-react-native';
import { useDriverProfile, useSession } from '@istanbul/core';
import { Button, Screen, Spacer, Text, useTheme } from '@istanbul/ui';
import { signOut } from '@istanbul/core';

/**
 * Porte d'entrée de l'app livreur.
 *
 * Trois cas : pas connecté → connexion. Connecté mais sans profil livreur →
 * message clair (un client ne doit pas se retrouver bloqué sur un écran
 * vide). Livreur non approuvé → écran d'attente.
 */
export default function Index() {
  const { session, isLoading } = useSession();
  const { data: driver, isLoading: driverLoading } = useDriverProfile();

  if (isLoading) return <SplashView />;
  if (!session) return <Redirect href="/sign-in" />;
  if (driverLoading) return <SplashView />;

  if (!driver) return <NotADriver />;
  if (!driver.is_approved) return <PendingApproval />;

  return <Redirect href="/(tabs)" />;
}

function SplashView() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceInverse }]}>
      <Animated.View entering={FadeIn.duration(theme.duration.slow)} style={{ alignItems: 'center' }}>
        <Motorcycle size={64} color={theme.colors.primary} weight="fill" />
        <Text
          variant="brandSmall"
          style={{ color: theme.colors.textInverse, marginTop: theme.spacing.base }}
        >
          Istanbul
        </Text>
        <Text
          variant="overline"
          uppercase
          style={{ color: theme.colors.primary, marginTop: theme.spacing.xs }}
        >
          Livreur
        </Text>
      </Animated.View>
    </View>
  );
}

function NotADriver() {
  const theme = useTheme();

  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.center}>
        <Motorcycle size={56} color={theme.colors.textMuted} weight="duotone" />
        <Text variant="h1" align="center" style={{ marginTop: theme.spacing.xl }}>
          Compte non reconnu
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.md, maxWidth: 320 }}
        >
          Cette application est réservée aux livreurs d’Istanbul Fast Food. Contactez le restaurant
          pour être enregistré.
        </Text>

        <Spacer size="2xl" />

        <Button label="Se déconnecter" variant="secondary" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function PendingApproval() {
  const theme = useTheme();

  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.center}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.colors.warningSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Motorcycle size={44} color={theme.colors.warning} weight="duotone" />
        </View>

        <Text variant="h1" align="center" style={{ marginTop: theme.spacing.xl }}>
          Compte en attente
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.md, maxWidth: 320 }}
        >
          Votre inscription a bien été reçue. Le restaurant doit valider votre compte avant que vous
          puissiez accepter des courses.
        </Text>

        <Spacer size="2xl" />

        <Button label="Se déconnecter" variant="secondary" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
