import { useCallback, useMemo } from 'react';

import { fermentsCache } from '@/lib/cache';
import { applyFermentChanges } from '@/lib/fermentOverlay';
import { listFerments, type Ferment } from '@/lib/ferments';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

/** A vessel's ferments, newest first; the last loaded copy is shown offline, with the changes waiting to upload. */
export function useFerments(tankId: string): FocusQuery<Ferment[]> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => listFerments(tankId), [tankId, uploadedCount]);
  const cache = useMemo(() => fermentsCache(userId, tankId), [userId, tankId]);
  const query = useFocusQuery(load, cache);
  const queued = items.some((item) => (item.kind === 'ferment-save' || item.kind === 'ferment-delete') && item.tankId === tankId);

  return useMemo(() => {
    if (!query.data && !queued) return query;
    return { ...query, data: applyFermentChanges(query.data ?? [], items, tankId), loading: query.loading && !queued };
  }, [query, items, tankId, queued]);
}
