/**
 * Edge Function `notify` — envoi des notifications push Expo.
 *
 * Point d'entrée unique pour les trois publics. Appelée par les triggers
 * PostgreSQL (via pg_net) ou directement depuis le dashboard.
 *
 * Déploiement :
 *   supabase functions deploy notify
 * (verify_jwt actif : les triggers pg_net envoient la clé anon en
 *  Authorization, lue depuis app_config.edge_notify_key.)
 *
 * Elle utilise la clé service_role : elle doit lire les tokens de n'importe
 * quel profil et écrire dans `notifications`, ce que la RLS interdit à un
 * utilisateur normal. C'est la seule raison d'être de cette fonction — tout
 * le reste passe par PostgREST avec les policies.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Topic =
  | 'ORDER_PLACED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ON_THE_WAY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'DELIVERY_OFFERED'
  | 'PROMOTION';

interface NotifyPayload {
  profile_id: string;
  topic: Topic;
  title?: string;
  body?: string;
  order_id?: string | null;
  data?: Record<string, unknown>;
}

/** Textes par défaut — le trigger n'a pas à les fournir. */
const TEMPLATES: Record<Topic, { title: string; body: string }> = {
  ORDER_PLACED: {
    title: 'Nouvelle commande',
    body: 'Une commande vient d’arriver. Ouvrez le dashboard.',
  },
  ORDER_ACCEPTED: {
    title: 'Commande confirmée',
    body: 'Le restaurant a accepté votre commande.',
  },
  ORDER_PREPARING: { title: 'En cuisine', body: 'Votre commande est en préparation.' },
  ORDER_READY: { title: 'Commande prête', body: 'Votre commande est prête.' },
  DRIVER_ASSIGNED: {
    title: 'Livreur assigné',
    body: 'Un livreur part récupérer votre commande.',
  },
  DRIVER_ON_THE_WAY: {
    title: 'Votre livreur arrive',
    body: 'Préparez votre code de confirmation.',
  },
  ORDER_DELIVERED: { title: 'Bon appétit !', body: 'Votre commande a été livrée.' },
  ORDER_CANCELLED: { title: 'Commande annulée', body: 'Votre commande a été annulée.' },
  DELIVERY_OFFERED: { title: 'Nouvelle course', body: 'Une livraison vous est proposée.' },
  PROMOTION: { title: 'Istanbul Fast Food', body: 'Une nouvelle offre vous attend.' },
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload = (await request.json()) as NotifyPayload;

  if (!payload.profile_id || !payload.topic) {
    return Response.json({ error: 'profile_id et topic sont requis.' }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const template = TEMPLATES[payload.topic];
  const title = payload.title ?? template.title;
  const body = payload.body ?? template.body;

  // --- Préférences et tokens ------------------------------------------------
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('push_tokens, notif_orders, notif_promos')
    .eq('id', payload.profile_id)
    .maybeSingle();

  if (error || !profile) {
    return Response.json({ error: 'Profil introuvable.' }, { status: 404 });
  }

  const isPromo = payload.topic === 'PROMOTION';
  const optedOut = isPromo ? !profile.notif_promos : !profile.notif_orders;

  // On journalise toujours, même si l'utilisateur a coupé le push : il doit
  // retrouver l'historique dans l'application.
  await supabase.from('notifications').insert({
    profile_id: payload.profile_id,
    topic: payload.topic,
    title,
    body,
    order_id: payload.order_id ?? null,
    data: payload.data ?? {},
    sent_at: optedOut ? null : new Date().toISOString(),
  });

  if (optedOut) {
    return Response.json({ sent: 0, reason: 'opted-out' });
  }

  const tokens: string[] = (profile.push_tokens ?? []).filter((token: string) =>
    token.startsWith('ExponentPushToken'),
  );

  if (tokens.length === 0) {
    return Response.json({ sent: 0, reason: 'no-token' });
  }

  // --- Envoi ---------------------------------------------------------------
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: { topic: payload.topic, order_id: payload.order_id, ...payload.data },
    channelId: 'default',
    priority: 'high',
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN')
        ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json();

  // Expo renvoie DeviceNotRegistered pour les appareils désinstallés : on
  // purge ces tokens, sinon la liste grossit indéfiniment.
  const stale: string[] = [];
  if (Array.isArray(result?.data)) {
    result.data.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
      if (ticket.details?.error === 'DeviceNotRegistered' && tokens[index]) {
        stale.push(tokens[index]!);
      }
    });
  }

  if (stale.length > 0) {
    await supabase
      .from('profiles')
      .update({ push_tokens: tokens.filter((token) => !stale.includes(token)) })
      .eq('id', payload.profile_id);
  }

  return Response.json({ sent: tokens.length - stale.length, pruned: stale.length });
});
