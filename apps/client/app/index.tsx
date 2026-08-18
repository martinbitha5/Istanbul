import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSession } from '@istanbul/core';
import { Text, useTheme } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/config';

/**
 * Écran d'entrée.
 *
 * Trois questions dans l'ordre : l'onboarding a-t-il été vu ? l'utilisateur
 * est-il connecté ? sinon, vers où ? Tant qu'on ne sait pas, on affiche le
 * splash animé — jamais un écran blanc, jamais un flash de l'écran de
 * connexion pour quelqu'un qui est déjà connecté.
 */
export default function Index() {
  const { session, isLoading } = useSession();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEYS.onboardingSeen).then((value) => {
      setOnboardingSeen(value === 'true');
    });
  }, []);

  if (isLoading || onboardingSeen === null) {
    return <SplashView />;
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;

  // Le catalogue est consultable sans compte : on n'exige la connexion qu'au
  // moment du checkout. Une barrière trop tôt fait fuir les nouveaux clients.
  return <Redirect href={session ? '/(tabs)' : '/(tabs)'} />;
}

function SplashView() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <Animated.View entering={FadeIn.duration(theme.duration.slow)} style={styles.center}>
        <Text variant="brand" style={{ color: '#FFFFFF' }}>
          Istanbul
        </Text>
        <Animated.View entering={FadeInDown.delay(220).duration(theme.duration.slow)}>
          <Text
            variant="overline"
            uppercase
            align="center"
            style={{ color: 'rgba(255,255,255,0.85)', marginTop: theme.spacing.sm }}
          >
            Fast Food
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(500).duration(theme.duration.slow)}
        style={[styles.footer, { paddingBottom: theme.spacing['4xl'] }]}
      >
        <Text variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Le vrai goût d’Istanbul, livré chez vous
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
