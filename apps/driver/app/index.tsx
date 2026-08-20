import { StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Motorcycle } from 'phosphor-react-native';
import { signOut, useDriverProfile, useSession } from '@istanbul/core';
import { EmptyState, ErrorState, IconBubble, Screen, Text, useTheme } from '@istanbul/ui';

/**
 * Porte d'entrée de l'app livreur.
 *
 * Trois cas : pas connecté → connexion. Connecté mais sans profil livreur →
 * message clair (un client ne doit pas se retrouver bloqué sur un écran
 * vide). Livreur non approuvé → écran d'attente.
 */
export default function Index() {
  const { session, isLoading } = useSession();
  const {
    data: driver,
    isLoading: driverLoading,
    isError: driverError,
    refetch,
  } = useDriverProfile();

  if (isLoading) return <SplashView />;
  if (!session) return <Redirect href="/sign-in" />;
  if (driverLoading) return <SplashView />;

  // Erreur réseau ≠ compte inconnu : afficher « Compte non reconnu » sur une
  // simple coupure 3G pousserait un vrai livreur à se déconnecter pour rien.
  if (driverError) {
    return (
      <Screen padded edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <ErrorState onRetry={() => void refetch()} />
        </View>
      </Screen>
    );
  }

  if (!driver) return <NotADriver />;
  if (!driver.is_approved) return <PendingApproval />;

  return <Redirect href="/(tabs)" />;
}

/**
 * Déconnexion : un seul pattern dans toute l'app — `signOut()` puis retour
 * au portier (`/`), qui redirige vers la connexion. Même logique dans
 * `app/(tabs)/profile.tsx`.
 */
function signOutToGate() {
  void signOut().then(() => router.replace('/'));
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
        <EmptyState
          title="Compte non reconnu"
          description="Cette application est réservée aux livreurs d’Istanbul Fast Food. Contactez le restaurant pour être enregistré."
          icon={<Motorcycle size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
          actionLabel="Se déconnecter"
          onAction={signOutToGate}
        />
      </View>
    </Screen>
  );
}

function PendingApproval() {
  const theme = useTheme();

  return (
    <Screen padded edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.center}>
        <IconBubble size={88} tone="warning">
          <Motorcycle size={44} color={theme.colors.warning} weight="duotone" />
        </IconBubble>

        <EmptyState
          title="Compte en attente"
          description="Votre inscription a bien été reçue. Le restaurant doit valider votre compte avant que vous puissiez accepter des courses."
          actionLabel="Se déconnecter"
          onAction={signOutToGate}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
