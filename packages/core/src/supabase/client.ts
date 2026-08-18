import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Fabrique du client Supabase.
 *
 * Le stockage est injecté par l'application appelante :
 *   - mobile  → AsyncStorage (persistant, hors du bundle web)
 *   - web     → localStorage (comportement par défaut)
 *   - serveur → aucun (sessions désactivées)
 *
 * On évite ainsi d'importer `@react-native-async-storage/async-storage` dans
 * un package partagé qui doit aussi tourner dans Next.js.
 */

export interface SupabaseStorage {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  storage?: SupabaseStorage;
  /** false côté serveur / rendu statique. */
  persistSession?: boolean;
  /** true uniquement en React Native (deep links de type `istanbul://`). */
  detectSessionInUrl?: boolean;
  headers?: Record<string, string>;
}

let client: SupabaseClient | null = null;

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error(
      "Supabase n'est pas configuré. Vérifiez EXPO_PUBLIC_SUPABASE_URL / " +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY (ou leurs équivalents NEXT_PUBLIC_).',
    );
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      storage: config.storage as never,
      autoRefreshToken: true,
      persistSession: config.persistSession ?? true,
      detectSessionInUrl: config.detectSessionInUrl ?? false,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-application-name': 'istanbul-fast-food',
        ...config.headers,
      },
    },
    realtime: {
      params: {
        // Plafond de messages/seconde : les positions GPS arrivent toutes les
        // 15 s, inutile d'ouvrir grand le robinet.
        eventsPerSecond: 5,
      },
    },
  });
}

/**
 * Enregistre le client de l'application. Appelé une fois au démarrage.
 * Les hooks du package l'utilisent ensuite sans le recevoir en paramètre.
 */
export function setSupabaseClient(instance: SupabaseClient): void {
  client = instance;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Client Supabase non initialisé. Appelez setSupabaseClient() au démarrage ' +
        "de l'application, avant tout rendu.",
    );
  }
  return client;
}

/**
 * Traduit une erreur PostgREST/PostgreSQL en message affichable.
 *
 * Les fonctions SQL lèvent des exceptions déjà rédigées en français : on les
 * remonte telles quelles. Le reste est traduit ici pour ne jamais montrer
 * « duplicate key value violates unique constraint » à un client.
 */
export function toUserMessage(error: unknown): string {
  if (!error) return 'Une erreur inattendue est survenue.';

  const err = error as { message?: string; code?: string; details?: string };
  const code = err.code;

  switch (code) {
    case 'PGRST301':
    case '42501':
      return "Vous n'avez pas l'autorisation d'effectuer cette action.";
    case '23505':
      return 'Cet élément existe déjà.';
    case '23503':
      return 'Cet élément est référencé ailleurs et ne peut pas être supprimé.';
    case 'PGRST116':
      return 'Élément introuvable.';
    case '23514':
    case 'P0001':
      // Exceptions métier levées par nos fonctions : déjà rédigées.
      return err.message ?? 'Opération refusée.';
    default:
      break;
  }

  const message = err.message ?? '';

  if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
    return 'Connexion impossible. Vérifiez votre connexion internet.';
  }
  if (message.includes('Invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (message.includes('User already registered')) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirmez votre email avant de vous connecter.';
  }
  if (message.includes('Token has expired') || message.includes('Invalid token')) {
    return 'Le code est expiré ou invalide. Demandez-en un nouveau.';
  }
  if (message.includes('For security purposes')) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }

  return message || 'Une erreur inattendue est survenue.';
}
