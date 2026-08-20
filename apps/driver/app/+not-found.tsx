import { router, Stack } from 'expo-router';
import { MapTrifold } from 'phosphor-react-native';
import { EmptyState, Screen, useTheme } from '@istanbul/ui';

/**
 * Route inconnue — typiquement un lien de notification vers une course
 * supprimée. Sans cet écran, expo-router affiche sa page par défaut en
 * anglais, hors charte.
 */
export default function NotFound() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          title="Page introuvable"
          description="Cette page n’existe pas ou n’est plus disponible."
          icon={<MapTrifold size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
          actionLabel="Retour à l’accueil"
          onAction={() => router.replace('/')}
          style={{ flex: 1 }}
        />
      </Screen>
    </>
  );
}
