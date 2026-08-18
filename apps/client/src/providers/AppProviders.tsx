import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createQueryClient } from '@istanbul/core';
import { ThemeProvider } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/config';

type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Fournisseurs racine.
 *
 * L'ordre compte : GestureHandler doit envelopper tout le reste, et
 * SafeAreaProvider doit être disponible avant le premier écran qui lit les
 * insets.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  // Restauration de la préférence de thème.
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEYS.themePreference).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setThemePreference(value);
      }
    });
  }, []);

  /**
   * Branche l'état réseau sur React Query : sans cela, les mutations
   * s'empilent en échec au lieu d'attendre le retour de la connexion —
   * cas fréquent sur un réseau mobile congolais.
   */
  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  const handleThemeChange = (preference: ThemePreference) => {
    setThemePreference(preference);
    void AsyncStorage.setItem(STORAGE_KEYS.themePreference, preference);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            initialPreference={themePreference}
            onPreferenceChange={handleThemeChange}
          >
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** État de connexion, pour le bandeau hors ligne. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected || state.isInternetReachable === false);
    });
  }, []);

  return offline;
}
