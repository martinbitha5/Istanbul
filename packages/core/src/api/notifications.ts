import type { AppNotification } from '@istanbul/types';
import { getSupabase } from '../supabase/client';

/**
 * Tokens Expo Push.
 *
 * L'append/remove est fait côté serveur (fn_register_push_token) : un update
 * direct de `profiles.push_tokens` depuis deux appareils écraserait la liste
 * de l'autre.
 */

export async function registerPushToken(token: string): Promise<void> {
  const { error } = await getSupabase().rpc('fn_register_push_token', { p_token: token });
  if (error) throw error;
}

export async function unregisterPushToken(token: string): Promise<void> {
  const { error } = await getSupabase().rpc('fn_unregister_push_token', { p_token: token });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Historique in-app — alimenté par l'Edge Function `notify`.
// ---------------------------------------------------------------------------

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('id, profile_id, topic, title, body, data, order_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw error;
}
