import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { log, registerPushToken, useSession } from '@istanbul/core';

/**
 * Notifications push côté livreur.
 *
 * Le cas qui paie le loyer : DELIVERY_OFFERED. Le livreur est au soleil sur
 * son scooter, l'app en poche — la notification doit sonner fort et le tap
 * doit l'amener directement sur la course.
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

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const register = async () => {
      try {
        if (!Device.isDevice) return;

        const current = await Notifications.getPermissionsAsync();
        let granted = current.status === 'granted';
        if (!granted) {
          const request = await Notifications.requestPermissionsAsync();
          granted = request.status === 'granted';
        }
        if (!granted || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Courses',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 400, 200, 400],
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
        log.warn('push.token.unavailable', { reason: String(error) });
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const open = (data: { delivery_id?: string } | undefined) => {
      if (data?.delivery_id) {
        router.push(`/delivery/${data.delivery_id}`);
      } else {
        router.push('/(tabs)');
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data as { delivery_id?: string });
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        open(response.notification.request.content.data as { delivery_id?: string });
      }
    });

    return () => subscription.remove();
  }, []);
}
