import { useCallback } from 'react';

import { listEntries, type Entry } from '@/lib/entries';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';

export function useEntries(tankId: string): FocusQuery<Entry[]> {
  const load = useCallback(() => listEntries(tankId), [tankId]);
  return useFocusQuery(load);
}
