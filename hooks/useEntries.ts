import { useCallback } from 'react';

import { getEntry, listEntries, type Entry } from '@/lib/entries';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';

export function useEntries(tankId: string): FocusQuery<Entry[]> {
  const load = useCallback(() => listEntries(tankId), [tankId]);
  return useFocusQuery(load);
}

export function useEntry(id: string): FocusQuery<Entry> {
  const load = useCallback(() => getEntry(id), [id]);
  return useFocusQuery(load);
}
