import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createSupabaseClient, setSupabaseClient, configureCartStorage } from '@istanbul/core';
import { setMapboxToken } from '@istanbul/map';
import { config } from './config';

/**
 * Initialisation du client Supabase pour React Native.
 *
 * Appelé une seule fois, au tout début de `app/_layout.tsx`, avant le premier
 * rendu — les hooks de `@istanbul/core` lèvent une erreur explicite si on les
 * utilise avant.
 */
export const supabase = createSupabaseClient({
  url: config.supabaseUrl,
  anonKey: config.supabaseAnonKey,
  storage: AsyncStorage,
  persistSession: true,
  // Nécessaire pour les liens de réinitialisation de mot de passe (istanbul://).
  detectSessionInUrl: false,
});

setSupabaseClient(supabase);
configureCartStorage(AsyncStorage);

// Même principe que Supabase : le package `@istanbul/map` ne lit pas
// l'environnement, l'app lui passe son jeton. Vide = cartes OpenStreetMap.
setMapboxToken(config.mapboxToken);

/**
 * Le rafraîchissement automatique du token ne doit tourner qu'au premier plan.
 * En arrière-plan il consomme de la batterie et échoue en boucle si le réseau
 * est coupé.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
