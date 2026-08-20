import '@/lib/supabase';

import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import { createQueryClient } from '@istanbul/core';
import { OfflineBanner, ThemeProvider, ToastProvider, useTheme, useToast } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/supabase';
import { useIsOffline } from '@/hooks/useIsOffline';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { initMonitoring } from '@/lib/monitoring';

initMonitoring();

void SplashScreen.preventAutoHideAsync();

/** Cache persistant : le livreur retrouve sa course même après une coupure 3G. */
const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'istanbul.driver.query-cache',
  throttleTime: 2_000,
});

type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Pont module-scope vers l'API toast : le queryClient est créé hors de
 * React, il ne peut donc pas appeler `useToast()` directement. Le composant
 * <ToastBridge/> (monté sous le ToastProvider) alimente cette ref.
 */
const toastApiRef: { current: ReturnType<typeof useToast> | null } = { current: null };

function ToastBridge() {
  const toast = useToast();
  useEffect(() => {
    toastApiRef.current = toast;
    return () => {
      toastApiRef.current = null;
    };
  }, [toast]);
  return null;
}

export default function RootLayout() {
  // Filet global anti-échec-silencieux : toute mutation qui échoue affiche
  // son message en toast — claimDelivery, advance, setAvailability incluses.
  const queryClient = useMemo(
    () =>
      createQueryClient({
        onMutationError: (message) => toastApiRef.current?.error(message),
      }),
    [],
  );
  const [preference, setPreference] = useState<ThemePreference>('system');

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

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEYS.themePreference).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') setPreference(value);
    });
  }, []);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  useEffect(() => {
    // React Query ne connaît pas le cycle de vie React Native : ce binding
    // gèle les refetchInterval quand l'app passe en arrière-plan — data et
    // batterie économisées pendant que le livreur roule écran éteint.
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: 'v1',
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => query.state.status === 'success',
            },
          }}
          onSuccess={() => {
            void queryClient.resumePausedMutations();
          }}
        >
          <ThemeProvider
            initialPreference={preference}
            onPreferenceChange={(next) => {
              setPreference(next);
              void AsyncStorage.setItem(STORAGE_KEYS.themePreference, next);
            }}
          >
            <ToastProvider>
              <ToastBridge />
              <DriverNavigator />
            </ToastProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function DriverNavigator() {
  const theme = useTheme();
  const offline = useIsOffline();

  // Token Expo + ouverture directe de la course depuis la notification.
  usePushNotifications();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {/* Monté à la racine (et plus dans les tabs) : l'écran /delivery/[id],
          le seul où le livreur agit devant le client, l'affiche aussi. */}
      <OfflineBanner visible={offline} safeAreaTop />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="delivery/[id]" />
      </Stack>
    </>
  );
}
