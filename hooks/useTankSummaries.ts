import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { evaluateRules, trippedAlerts } from '@/lib/alertRules';
import { entriesCache, fermentsCache, rulesCache } from '@/lib/cache';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { activeFerment, fermentDay } from '@/lib/fermentCurves';
import { applyFermentChanges } from '@/lib/fermentOverlay';
import { applyRuleChanges } from '@/lib/ruleOverlay';
import type { EntryType } from '@/lib/entryTypes';
import { latestValues, type LatestValue } from '@/lib/latestValues';

import { useOutbox } from './useOutbox';
import { useUser } from './useSession';

export type LastActivity = { type: EntryType; createdAt: string };

export type TankSummary = {
  /** The most recent entry, if any. */
  last: LastActivity | undefined;
  /** The newest reading of each value (see lib/latestValues.ts). */
  latest: LatestValue[];
  /** The running ferment and what day it's on, from the saved copy. */
  ferment: { name: string; day: number } | null;
  /** How many alert rules have tripped on the running ferment. */
  alerts: number;
};

/**
 * Each tank's most recent entry and latest readings, from the timelines saved
 * on the phone (every sync saves all of them) with the changes waiting to
 * upload applied. No network request, so it works offline too. Re-read
 * whenever the screen comes back into view.
 */
export function useTankSummaries(tankIds: readonly string[]): Map<string, TankSummary> {
  const { id: userId } = useUser();
  const { items, uploadedCount } = useOutbox();
  const [visits, setVisits] = useState(0);
  useFocusEffect(useCallback(() => setVisits((n) => n + 1), []));

  const key = tankIds.join(',');
  return useMemo(() => {
    void visits;
    void uploadedCount;
    const summaries = new Map<string, TankSummary>();
    for (const tankId of key === '' ? [] : key.split(',')) {
      const saved = entriesCache(userId, tankId).read()?.data ?? [];
      const timeline = applyEntryChanges(saved, items, tankId);
      const newest = timeline[0];
      const ferments = applyFermentChanges(fermentsCache(userId, tankId).read()?.data ?? [], items, tankId);
      const running = activeFerment(ferments);
      const alerts = trippedAlerts(evaluateRules(applyRuleChanges(rulesCache(userId, tankId).read()?.data ?? [], items, tankId), timeline, ferments)).length;
      summaries.set(tankId, {
        last: newest ? { type: newest.type, createdAt: newest.createdAt } : undefined,
        latest: latestValues(timeline),
        ferment: running ? { name: running.name, day: fermentDay(running.startedAt, new Date()) } : null,
        alerts,
      });
    }
    return summaries;
  }, [userId, key, items, uploadedCount, visits]);
}
