import { useCallback, useMemo } from 'react';

import { entriesCache, entryCache } from '@/lib/cache';
import { getEntry, listEntries, type Entry } from '@/lib/entries';
import { applyChangesToEntry, type ShownEntry } from '@/lib/entryOverlay';
import { isLocalEntry } from '@/lib/outbox';

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

/**
 * One entry, to edit it. With its tank's id it opens offline from the saved
 * timeline; changes still waiting to upload are applied on top, and an entry
 * that only exists on this phone comes straight from the queue.
 */
export function useEntry(id: string, tankId?: string): FocusQuery<ShownEntry> {
  const { id: userId } = useUser();
  const { items } = useOutbox();
  const load = useCallback(() => getEntry(id), [id]);
  const cache = useMemo(() => (tankId ? entryCache(userId, tankId, id) : undefined), [userId, tankId, id]);
  const query = useFocusQuery<Entry>(load, cache);

  return useMemo(() => {
    const shown = applyChangesToEntry(query.data, items, id);
    // Not on the server yet, so its "not found" from the server means nothing.
    const localOnly = isLocalEntry(items, id);
    return {
      ...query,
      data: shown,
      error: localOnly ? null : query.error,
      cachedAt: localOnly ? null : query.cachedAt,
      loading: query.loading && shown === undefined,
    };
  }, [query, items, id]);
}
