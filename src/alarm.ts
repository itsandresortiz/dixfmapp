import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type Alarm = { hour: number; minute: number };

const KEY = 'dix.alarm';
const CHANNEL = 'alarm';
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

const isWake = (n: Notifications.Notification) => n.request.content.data?.action === 'play';

/**
 * Despertador: un aviso diario a la hora elegida. Si la app está abierta, la radio
 * empieza sola; si está cerrada, empieza al tocar el aviso (el sistema no deja que
 * una app arranque audio por su cuenta estando cerrada).
 */
export function useAlarm(onWake: () => void) {
  const [alarm, setAlarmState] = useState<Alarm | null>(null);
  const wake = useRef(onWake);
  wake.current = onWake;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setAlarmState(JSON.parse(raw)))
      .catch(() => {});
    if (!supported) return;

    const received = Notifications.addNotificationReceivedListener((n) => isWake(n) && wake.current());
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => isWake(r.notification) && wake.current());
    // La app se abrió tocando el aviso.
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && isWake(r.notification) && Date.now() - r.notification.date < 120000 && wake.current())
      .catch(() => {});
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);

  const clearAlarm = useCallback(async () => {
    setAlarmState(null);
    await AsyncStorage.removeItem(KEY).catch(() => {});
    if (supported) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }, []);

  /** Devuelve false si el usuario no dio permiso de notificaciones. */
  const setAlarm = useCallback(async (next: Alarm) => {
    if (supported) {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return false;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Despertador',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        });
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Buenos días',
          body: 'Toca para despertar con Dix FM en vivo.',
          sound: true,
          data: { action: 'play' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: next.hour, minute: next.minute, channelId: CHANNEL },
      });
    }
    setAlarmState(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return true;
  }, []);

  return { alarm, setAlarm, clearAlarm };
}

export const formatAlarm = (alarm: Alarm) =>
  new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, alarm.hour, alarm.minute));
