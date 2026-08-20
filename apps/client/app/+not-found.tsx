import { router } from 'expo-router';
import { Compass } from 'phosphor-react-native';
import { EmptyState, Header, Screen, useTheme } from '@istanbul/ui';

/**
 * Route inconnue.
 *
 * Atteignable via un deep link périmé ou une notification pointant vers un
 * écran supprimé : sans ce fichier, expo-router affiche son écran de debug
 * anglophone, hors du design system.
 */
export default function NotFound() {
  const theme = useTheme();

  return (
    <Screen>
      <Header onBack={router.canGoBack() ? () => router.back() : undefined} />
      <EmptyState
        title="Page introuvable"
        description="Le lien que vous avez suivi ne mène nulle part. Il a peut-être expiré."
        actionLabel="Retour à l’accueil"
        onAction={() => router.replace('/(tabs)')}
        icon={<Compass size={theme.iconSize.xl} color={theme.colors.textMuted} weight="duotone" />}
      />
    </Screen>
  );
}
