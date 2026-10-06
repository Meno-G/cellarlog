import { useCallback, useMemo } from 'react';

import { tankCache, tanksCache } from '@/lib/cache';
import { getTank, listTanks, type Tank } from '@/lib/tanks';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useUser } from './useSession';

/** The user's tanks; the last loaded list is shown offline. */
export function useTanks(): FocusQuery<Tank[]> {
  const { id: userId } = useUser();
  const cache = useMemo(() => tanksCache(userId), [userId]);
  return useFocusQuery(listTanks, cache);
}

export function useTank(id: string): FocusQuery<Tank> {
  const { id: userId } = useUser();
  const load = useCallback(() => getTank(id), [id]);
  const cache = useMemo(() => tankCache(userId, id), [userId, id]);
  return useFocusQuery(load, cache);
}
