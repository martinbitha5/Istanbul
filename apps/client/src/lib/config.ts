/**
 * Configuration de l'application.
 *
 * On échoue bruyamment au démarrage plutôt que de laisser l'app planter au
 * premier appel réseau avec un message incompréhensible.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}.\n` +
        'Copiez .env.example vers .env dans apps/client/ puis relancez `pnpm client`.',
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
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',

  /**
   * L'identifiant d'Istanbul dans la base visée. Variable d'environnement et
   * non constante en dur, pour que le build de développement pointe sur la
   * base locale (où l'UUID vient du seed) et celui du store sur la production.
   */
  restaurantId:
    process.env.EXPO_PUBLIC_RESTAURANT_ID ?? '00000000-0000-0000-0000-000000000001',

  isDev: process.env.EXPO_PUBLIC_ENV !== 'production',
} as const;

/**
 * Numéro du restaurant affiché en secours tant que la fiche restaurant n'est
 * pas chargée (démarrage hors ligne). Dès qu'elle l'est, `restaurant.phone`
 * fait autorité — ce fallback ne doit exister qu'ici, jamais dans un écran.
 */
export const FALLBACK_RESTAURANT_PHONE = '+243999000111';

export const STORAGE_KEYS = {
  onboardingSeen: 'istanbul.onboarding.seen',
  themePreference: 'istanbul.theme',
  lastAddressId: 'istanbul.address.last',
} as const;
