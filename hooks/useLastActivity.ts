import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { entriesCache } from '@/lib/cache';
import type { EntryType } from '@/lib/entryTypes';

import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

export type LastActivity = { type: EntryType; createdAt: string };

/**
 * Each tank's most recent entry, from the timelines saved on the phone (every
 * sync saves all of them) plus entries waiting to upload. No network request,
 * so it works offline too. Re-read whenever the screen comes back into view.
 */
export function useLastActivity(tankIds: readonly string[]): Map<string, LastActivity> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  const [visits, setVisits] = useState(0);
  useFocusEffect(useCallback(() => setVisits((n) => n + 1), []));

  const key = tankIds.join(',');
  return useMemo(() => {
    void visits;
    void uploadedCount;
    const latest = new Map<string, LastActivity>();
    const consider = (tankId: string, activity: LastActivity) => {
      const current = latest.get(tankId);
      if (!current || activity.createdAt > current.createdAt) latest.set(tankId, activity);
    };
    for (const tankId of key === '' ? [] : key.split(',')) {
      const newest = entriesCache(userId, tankId).read()?.data[0];
      if (newest) consider(tankId, { type: newest.type, createdAt: newest.createdAt });
    }
    for (const item of items) {
      if (item.kind === 'entry') consider(item.tankId, { type: item.type, createdAt: item.createdAt });
    }
    return latest;
  }, [userId, key, items, uploadedCount, visits]);
}
