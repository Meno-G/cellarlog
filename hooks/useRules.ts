import { useCallback, useMemo } from 'react';

import { listRules, type SavedRule } from '@/lib/alerts';
import { rulesCache } from '@/lib/cache';
import { applyRuleChanges } from '@/lib/ruleOverlay';

import { useFocusQuery, type FocusQuery } from './useFocusQuery';
import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

/** A vessel's alert rules; the last loaded copy is shown offline, with the changes waiting to upload. */
export function useRules(tankId: string): FocusQuery<SavedRule[]> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => listRules(tankId), [tankId, uploadedCount]);
  const cache = useMemo(() => rulesCache(userId, tankId), [userId, tankId]);
  const query = useFocusQuery(load, cache);
  const queued = items.some((item) => item.kind === 'rule-save' && item.tankId === tankId);

  return useMemo(() => {
    if (!query.data && !queued) return query;
    return { ...query, data: applyRuleChanges(query.data ?? [], items, tankId), loading: query.loading && !queued };
  }, [query, items, tankId, queued]);
}
