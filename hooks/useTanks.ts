import { useCallback, useMemo } from 'react';

import { tankCache, tanksCache } from '@/lib/cache';
import { applyTankChanges, type ShownTank } from '@/lib/tankOverlay';
import { getTank, listTanks } from '@/lib/tanks';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

/**
 * The user's tanks: from the server, or the saved copy offline, with tank
 * changes made offline (new tanks, edits) shown on top until they upload.
 */
export function useTanks(): FocusQuery<ShownTank[]> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  // uploadedCount: reload after queued changes reach the server.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => listTanks(), [uploadedCount]);
  const cache = useMemo(() => tanksCache(userId), [userId]);
  const query = useFocusQuery(load, cache);

  const data = useMemo(
    () => (query.data || items.some((item) => item.kind === 'tank-create') ? applyTankChanges(query.data ?? [], items) : undefined),
    [query.data, items],
  );
  return { ...query, data, loading: query.loading && data === undefined };
}

export function useTank(id: string): FocusQuery<ShownTank> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => getTank(id), [id, uploadedCount]);
  const cache = useMemo(() => tankCache(userId, id), [userId, id]);
  const query = useFocusQuery(load, cache);

  return useMemo(() => {
    const shown = applyTankChanges(query.data ? [query.data] : [], items).find((tank) => tank.id === id);
    if (!shown) return { ...query, data: undefined };
    // A tank that so far exists only on this phone: the server can't know it yet, so no error.
    const localOnly = items.some((item) => item.kind === 'tank-create' && item.localId === id);
    return {
      ...query,
      data: shown,
      error: localOnly ? null : query.error,
      cachedAt: localOnly ? null : query.cachedAt,
      loading: false,
    };
  }, [query, items, id]);
}
