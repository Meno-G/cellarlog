import { useCallback, useMemo } from 'react';

import { entriesCache } from '@/lib/cache';
import { getEntry, listEntries, type Entry } from '@/lib/entries';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

/** A tank's timeline; the last loaded one is shown offline. Reloads after queued entries upload. */
export function useEntries(tankId: string): FocusQuery<Entry[]> {
  const { id: userId } = useUser();
  const { uploadedCount } = useOutbox();
  const load = useCallback(
    () => listEntries(tankId),
    // uploadedCount: reload the timeline when queued entries have been uploaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tankId, uploadedCount],
  );
  const cache = useMemo(() => entriesCache(userId, tankId), [userId, tankId]);
  return useFocusQuery(load, cache);
}

export function useEntry(id: string): FocusQuery<Entry> {
  const load = useCallback(() => getEntry(id), [id]);
  return useFocusQuery(load);
}
