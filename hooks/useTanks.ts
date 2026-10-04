import { useCallback } from 'react';

import { getTank, listTanks, type Tank } from '@/lib/tanks';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';

export function useTanks(): FocusQuery<Tank[]> {
  return useFocusQuery(listTanks);
}

export function useTank(id: string): FocusQuery<Tank> {
  const load = useCallback(() => getTank(id), [id]);
  return useFocusQuery(load);
}
