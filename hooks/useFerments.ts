import { useCallback, useMemo } from 'react';

import { fermentsCache } from '@/lib/cache';
import { listFerments, type Ferment } from '@/lib/ferments';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useUser } from './useSession';

/** A vessel's ferments, newest first; the last loaded copy is shown offline. */
export function useFerments(tankId: string): FocusQuery<Ferment[]> {
  const { id: userId } = useUser();
  const load = useCallback(() => listFerments(tankId), [tankId]);
  const cache = useMemo(() => fermentsCache(userId, tankId), [userId, tankId]);
  return useFocusQuery(load, cache);
}
