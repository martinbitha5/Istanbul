import '@/lib/supabase';

import { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
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
import { ThemeProvider, useTheme } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/supabase';

void SplashScreen.preventAutoHideAsync();

type ThemePreference = 'light' | 'dark' | 'system';

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);
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
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            initialPreference={preference}
            onPreferenceChange={(next) => {
              setPreference(next);
              void AsyncStorage.setItem(STORAGE_KEYS.themePreference, next);
            }}
          >
            <DriverNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function DriverNavigator() {
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
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="delivery/[id]" />
      </Stack>
    </>
  );
}
