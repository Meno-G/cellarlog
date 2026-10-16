import { useCallback, useMemo } from 'react';

import { listRules, type SavedRule } from '@/lib/alerts';
import { rulesCache } from '@/lib/cache';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useUser } from './useSession';

/** A vessel's alert rules; the last loaded copy is shown offline. */
export function useRules(tankId: string): FocusQuery<SavedRule[]> {
  const { id: userId } = useUser();
  const load = useCallback(() => listRules(tankId), [tankId]);
  const cache = useMemo(() => rulesCache(userId, tankId), [userId, tankId]);
  return useFocusQuery(load, cache);
}
