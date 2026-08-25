import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createQueryClient } from '@istanbul/core';
import { ThemeProvider, ToastProvider, useToast } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/config';

type ToastApi = ReturnType<typeof useToast>;

/**
 * Pont vers le toast pour le code créé HORS de React (le QueryClient).
 * `ToastBridge`, monté dans le ToastProvider, remplit cette référence ; le
 * mutationCache la lit au moment de l'erreur. C'est le filet global : aucune
 * mutation ne peut plus échouer en silence.
 */
const toastApiRef: { current: ToastApi | null } = { current: null };

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

/**
 * Fournisseurs racine.
 *
 * L'ordre compte : GestureHandler doit envelopper tout le reste, et
 * SafeAreaProvider doit être disponible avant le premier écran qui lit les
 * insets.
 */
/**
 * Cache React Query persistant : au démarrage, l'app repart du dernier état
 * connu (menu, commandes, favoris) même sans réseau — cas courant à Kinshasa.
 * `buster` invalide tout le cache quand la forme des données change.
 */
const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'istanbul.query-cache',
  throttleTime: 2_000,
});

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;
// v2 : purge des caches v1 qui pouvaient contenir une commande sans `items`
// (semée par l'ancien usePlaceOrder).
const CACHE_BUSTER = 'v2';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      createQueryClient({
        onMutationError: (message) => toastApiRef.current?.error(message),
      }),
    [],
  );

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: PERSIST_MAX_AGE,
            buster: CACHE_BUSTER,
            dehydrateOptions: {
              // On ne persiste que ce qui a réussi : une erreur réseau gelée
              // dans le cache réapparaîtrait au prochain démarrage.
              shouldDehydrateQuery: (query) => query.state.status === 'success',
            },
          }}
          onSuccess={() => {
            // Les mutations mises en attente hors-ligne repartent dès la
            // restauration du cache.
            void queryClient.resumePausedMutations();
          }}
        >
          <ThemeProvider>
            {/* Dans le ThemeProvider ET le SafeAreaProvider : le toast lit les
                deux pour se positionner sous la barre de statut. */}
            <ToastProvider>
              <ToastBridge />
              {children}
            </ToastProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
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
