import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { entriesCache, fermentsCache, tanksCache } from '@/lib/cache';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { activeFerment } from '@/lib/fermentCurves';
import { applyFermentChanges } from '@/lib/fermentOverlay';
import { notifications, reminderPermission, scheduleReminders } from '@/lib/notifications';
import { planReminders, readReminders, setReminder } from '@/lib/reminders';

import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

// Screens tell the sync that a setting changed.
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

/**
 * Keeps the scheduled reminders in step with the cellar: whenever the app starts,
 * comes to the foreground, saves an entry or a setting changes, the next
 * reminders are planned again from the saved copy (so offline works too).
 * Mounted once, inside the signed-in app.
 */
export function useReminderSync(): void {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    listeners.add(bump);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') bump();
    });
    return () => {
      listeners.delete(bump);
      appState.remove();
    };
  }, []);

  useEffect(() => {
    void tick;
    void uploadedCount;
    if (!notifications()) return;
    // A short pause, so a burst of changes plans once.
    const timer = setTimeout(() => {
      const tanks = tanksCache(userId).read()?.data ?? [];
      const planned = planReminders({
        settings: readReminders(userId),
        tanks,
        runningSince: (tankId) =>
          activeFerment(applyFermentChanges(fermentsCache(userId, tankId).read()?.data ?? [], items, tankId))?.startedAt ?? null,
        timeline: (tankId) => applyEntryChanges(entriesCache(userId, tankId).read()?.data ?? [], items, tankId),
        now: new Date(),
      });
      void scheduleReminders(planned);
    }, 600);
    return () => clearTimeout(timer);
  }, [userId, items, uploadedCount, tick]);
}

/** One vessel's reminder (hours, or null when off) and how to change it. */
export function useReminder(tankId: string): {
  available: boolean;
  hours: number | null;
  /** Returns false when the phone's notification permission was refused. */
  change: (hours: number | null) => Promise<boolean>;
} {
  const { id: userId } = useUser();
  const [hours, setHours] = useState<number | null>(() => readReminders(userId)[tankId] ?? null);

  const change = useCallback(
    async (next: number | null): Promise<boolean> => {
      if (next !== null && (await reminderPermission(true)) !== 'granted') return false;
      setReminder(userId, tankId, next);
      setHours(next);
      changed();
      return true;
    },
    [userId, tankId],
  );

  return { available: notifications() !== null, hours, change };
}
