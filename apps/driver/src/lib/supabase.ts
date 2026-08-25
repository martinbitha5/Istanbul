import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createSupabaseClient, setSupabaseClient } from '@istanbul/core';
import { setMapboxToken } from '@istanbul/map';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}.\n` +
        'Copiez .env.example vers .env dans apps/driver/ puis relancez `pnpm driver`.',
    );
  }
  return value;
}

export const config = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  // Pas `required` : sans jeton, la carte retombe sur OpenStreetMap. Une app
  // livreur qui refuse de démarrer faute de clé cartographique serait une
  // régression, pas un garde-fou.
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',
} as const;

export const supabase = createSupabaseClient({
  url: config.supabaseUrl,
  anonKey: config.supabaseAnonKey,
  storage: AsyncStorage,
  persistSession: true,
});

setSupabaseClient(supabase);
setMapboxToken(config.mapboxToken);

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

export const STORAGE_KEYS = {
  themePreference: 'istanbul.driver.theme',
} as const;
