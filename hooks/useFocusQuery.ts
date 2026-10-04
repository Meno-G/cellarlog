import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { errorMessage } from '@/lib/errors';

export type FocusQuery<T> = {
  /** Last successful result. Kept while refetching, and when a later refetch fails. */
  data: T | undefined;
  /** Message from the latest failed load, or null. */
  error: string | null;
  /** True only for the very first load (no data yet). */
  loading: boolean;
  /** True while a pull-to-refresh is running. */
  refreshing: boolean;
  /** Pull-to-refresh / "Try again". */
  refresh: () => void;
};

/**
 * Runs `load` every time the screen gains focus, so lists are fresh after
 * returning from a create/edit screen. `load` must be stable (module function
 * or useCallback), or it will refetch on every render.
 */
export function useFocusQuery<T>(load: () => Promise<T>): FocusQuery<T> {
  const [data, setData] = useState<T>();
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
        setError(null);
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
    [load],
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

  return { data, error, loading: pending && data === undefined && error === null, refreshing, refresh };
}
