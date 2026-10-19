// Scheduling the measurement reminders as local notifications on the phone.
// expo-notifications is a native module: this phone's build may not have it (an
// older build, or the browser), so it is loaded only when needed and everything
// here quietly does nothing without it. Not pure, so not part of `npm test`.
import { Platform } from 'react-native';

import { strings } from './i18n';
import type { PlannedReminder } from './reminders';

type NotificationsModule = typeof import('expo-notifications');

const PREFIX = 'cellarlog-reminder:';
const CHANNEL = 'reminders';

let loaded: NotificationsModule | null | undefined;

/** The notifications module, or null in the browser and in builds that don't include it. */
export function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === 'web') {
    loaded = null;
    return loaded;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-notifications') as NotificationsModule;
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    loaded = module;
  } catch {
    loaded = null;
  }
  return loaded;
}

export type ReminderPermission = 'granted' | 'denied' | 'unavailable';

async function ensureChannel(module: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await module.setNotificationChannelAsync(CHANNEL, {
    name: strings().reminders.channel,
    importance: module.AndroidImportance.HIGH,
  });
}

/** Whether reminders may be shown; with `ask`, asks the user once if not decided yet. */
export async function reminderPermission(ask: boolean): Promise<ReminderPermission> {
  const module = notifications();
  if (!module) return 'unavailable';
  try {
    // On Android 13+ the permission prompt only appears once a channel exists.
    await ensureChannel(module);
    let { status } = await module.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await module.requestPermissionsAsync()).status;
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Replaces all scheduled reminders with these (nothing is scheduled without permission). */
export async function scheduleReminders(reminders: readonly PlannedReminder[]): Promise<void> {
  const module = notifications();
  if (!module) return;
  try {
    const scheduled = await module.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(PREFIX))
        .map((item) => module.cancelScheduledNotificationAsync(item.identifier)),
    );
    if (reminders.length === 0 || (await reminderPermission(false)) !== 'granted') return;
    const body = strings().reminders.body;
    for (const reminder of reminders) {
      await module.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.tankName, body },
        trigger: { type: module.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL },
      });
    }
  } catch {
    // Reminders are a convenience: a failure here must never get in the way of the log.
  }
}
