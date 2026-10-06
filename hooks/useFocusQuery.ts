import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { CacheAdapter } from '@/lib/cache';
import { errorMessage } from '@/lib/errors';

export type FocusQuery<T> = {
  /** Latest data: from the server, or the cached copy until the server answers. */
  data: T | undefined;
  /** Message from the latest failed load, or null. */
  error: string | null;
  /** True only for the very first load with nothing to show yet. */
  loading: boolean;
  /** True while a pull-to-refresh is running. */
  refreshing: boolean;
  /** The data shown is the cached copy saved at this time (the server hasn't answered). */
  cachedAt: string | null;
  /** Pull-to-refresh / "Try again". */
  refresh: () => void;
};

/**
 * Runs `load` every time the screen gains focus, so lists are fresh after
 * returning from a create/edit screen. `load` and `cache` must be stable
 * (module function, useCallback, useMemo), or it will refetch on every render.
 *
 * With a `cache`, the cached copy is shown at once (and offline), and every
 * successful load is written back to it.
 */
export function useFocusQuery<T>(load: () => Promise<T>, cache?: CacheAdapter<T>): FocusQuery<T> {
  const [initial] = useState(() => cache?.read() ?? null);
  const [data, setData] = useState<T | undefined>(initial?.data);
  const [cachedAt, setCachedAt] = useState<string | null>(initial?.savedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);

  const run = useCallback(
    async (fromPull: boolean) => {
      const request = ++latestRequest.current;
      setPending(true);
      if (fromPull) setRefreshing(true);
      try {
        const result = await load();
        if (request !== latestRequest.current) return;
        setData(result);
        setCachedAt(null);
        setError(null);
        cache?.write(result);
      } catch (err) {
        if (request !== latestRequest.current) return;
        setError(errorMessage(err));
      } finally {
        if (request === latestRequest.current) {
          setPending(false);
          setRefreshing(false);
        }
      }
    },
    [load, cache],
  );

  useFocusEffect(
    useCallback(() => {
      void run(false);
      return () => {
        // Ignore responses that arrive after the screen lost focus.
        latestRequest.current++;
      };
    }, [run]),
  );

  const refresh = useCallback(() => {
    void run(true);
  }, [run]);

  return {
    data,
    error,
    loading: pending && data === undefined && error === null,
    refreshing,
    cachedAt,
    refresh,
  };
}
