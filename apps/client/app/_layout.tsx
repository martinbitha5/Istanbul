import '@/lib/supabase'; // doit rester le premier import : initialise Supabase

import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Sora_500Medium, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  PlayfairDisplaySC_400Regular,
  PlayfairDisplaySC_700Bold,
} from '@expo-google-fonts/playfair-display-sc';
import { useTheme } from '@istanbul/ui';
import { AppProviders } from '@/providers/AppProviders';

// Le splash natif reste affiché tant que les polices ne sont pas prêtes :
// sinon le premier écran apparaît en Helvetica puis saute en Sora.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    PlayfairDisplaySC_400Regular,
    PlayfairDisplaySC_700Bold,
  });

  const onReady = useCallback(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // On laisse passer une erreur de police : mieux vaut une app en police
  // système qu'un écran blanc définitif.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />

        {/* Fiche produit : feuille modale, on reste dans le contexte du menu. */}
        <Stack.Screen
          name="product/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="cart" options={{ presentation: 'modal' }} />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="addresses" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
