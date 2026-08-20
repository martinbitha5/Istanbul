import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { log, registerPushToken, useSession } from '@istanbul/core';

/**
 * Notifications push côté client.
 *
 * Deux responsabilités :
 *   1. obtenir le token Expo et l'enregistrer sur le profil (RPC serveur) ;
 *   2. ouvrir le bon écran quand l'utilisateur touche une notification.
 *
 * Tout est best-effort : sur Expo Go (qui ne supporte plus le push distant)
 * ou si la permission est refusée, l'app fonctionne normalement — le client
 * suit sa commande dans l'écran temps réel.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(): void {
  const { session } = useSession();
  const registeredToken = useRef<string | null>(null);

  // --- Enregistrement du token à la connexion -----------------------------
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const register = async () => {
      try {
        if (!Device.isDevice) return; // émulateur : pas de push

        const current = await Notifications.getPermissionsAsync();
        let granted = current.status === 'granted';
        if (!granted) {
          const request = await Notifications.requestPermissionsAsync();
          granted = request.status === 'granted';
        }
        if (!granted || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Commandes',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
          });
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        // Placeholder tant que le projet EAS n'existe pas : ne pas appeler
        // Expo pour rien (400 garanti). L'app fonctionne sans push.
        if (!projectId || projectId.startsWith('00000000')) return;

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

        if (cancelled || registeredToken.current === token) return;

        await registerPushToken(token);
        registeredToken.current = token;
        log.info('push.token.registered');
      } catch (error) {
        // Expo Go, permission système, réseau : aucun de ces échecs n'est bloquant.
        log.warn('push.token.unavailable', { reason: String(error) });
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Navigation au tap ---------------------------------------------------
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        order_id?: string;
      };
      if (data?.order_id) {
        router.push(`/order/${data.order_id}`);
      }
    });

    // Notification qui a lancé l'app (état "tué").
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as
        | { order_id?: string }
        | undefined;
      if (data?.order_id) {
        router.push(`/order/${data.order_id}`);
      }
    });

    return () => subscription.remove();
  }, []);
}
