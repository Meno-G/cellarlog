import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type { ValidEntry } from '@/lib/entryDraft';
import { errorMessage } from '@/lib/errors';
import {
  discardLocalTank,
  isLocalTank,
  listOutbox,
  markPending,
  removeFromOutbox,
  type OutboxItem,
} from '@/lib/outbox';
import {
  createTankOrQueue,
  flushOutbox,
  refreshOfflineCopy,
  saveOrQueue,
  updateTankOrQueue,
  type SaveResult,
} from '@/lib/sync';
import type { TankInput } from '@/lib/tanks';

type OutboxValue = {
  /** Changes saved on this phone and not uploaded yet (entries, new tanks, tank edits), oldest first. */
  items: OutboxItem[];
  /** Waiting for a connection (not counting failed ones). */
  pendingCount: number;
  failedCount: number;
  uploading: boolean;
  /** Message from the last upload attempt that was interrupted, or null. */
  lastError: string | null;
  /** Goes up each time queued changes reach the server, so screens reload. */
  uploadedCount: number;
  /** Save now, or keep on the phone when offline. */
  saveEntry: (entry: ValidEntry) => Promise<SaveResult>;
  /** Create a tank now, or on this phone when offline. Returns the new tank's id either way. */
  createTank: (tank: TankInput) => Promise<{ id: string; result: SaveResult }>;
  updateTank: (tankId: string, tank: TankInput) => Promise<SaveResult>;
  uploadNow: () => void;
  retry: (localId: string) => void;
  discard: (localId: string) => void;
  /** Throws away a tank created offline and the entries queued for it. */
  discardTank: (tankId: string) => void;
};

const OutboxContext = createContext<OutboxValue | null>(null);

function isOffline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function OutboxProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [items, setItems] = useState<OutboxItem[]>(() => listOutbox(userId));
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const reload = useCallback(() => setItems(listOutbox(userId)), [userId]);

  /** Upload queued entries, then refresh the offline copy of every tank and timeline. */
  const upload = useCallback(async () => {
    if (isOffline(await NetInfo.fetch())) return;
    let interrupted = false;
    if (listOutbox(userId).some((item) => item.status === 'pending')) {
      setUploading(true);
      try {
        const result = await flushOutbox(userId);
        interrupted = result.interrupted;
        if (result.uploaded > 0) setUploadedCount((count) => count + result.uploaded);
        setLastError(interrupted ? 'Upload paused: no connection. It continues when you are back online.' : null);
      } catch (error) {
        interrupted = true;
        setLastError(errorMessage(error));
      } finally {
        setUploading(false);
        reload();
      }
    }
    if (!interrupted) {
      // Best effort, in the background: screens still load on their own.
      refreshOfflineCopy(userId).catch(() => undefined);
    }
  }, [userId, reload]);

  // Sync on start, when the connection comes back, and when the app returns to the foreground.
  const uploadFromEffect = useEffectEvent(() => {
    void upload();
  });
  useEffect(() => {
    uploadFromEffect();
    let wasOffline = false;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const offline = isOffline(state);
      if (wasOffline && !offline) uploadFromEffect();
      wasOffline = offline;
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') uploadFromEffect();
    });
    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, []);

  /** Queue instead of sending when offline, or when the tank only exists on this phone so far. */
  const mustQueue = useCallback(
    async (tankId: string | null) =>
      (tankId !== null && isLocalTank(listOutbox(userId), tankId)) || isOffline(await NetInfo.fetch()),
    [userId],
  );

  const saveEntry = useCallback(
    async (entry: ValidEntry): Promise<SaveResult> => {
      const result = await saveOrQueue(userId, entry, await mustQueue(entry.tankId));
      reload();
      if (result === 'queued') void upload(); // sends it right away if the tank just became uploadable
      return result;
    },
    [userId, reload, mustQueue, upload],
  );

  const createTank = useCallback(
    async (tank: TankInput) => {
      const saved = await createTankOrQueue(userId, tank, await mustQueue(null));
      reload();
      return saved;
    },
    [userId, reload, mustQueue],
  );

  const updateTank = useCallback(
    async (tankId: string, tank: TankInput): Promise<SaveResult> => {
      const result = await updateTankOrQueue(userId, tankId, tank, await mustQueue(tankId));
      reload();
      if (result === 'queued') void upload();
      return result;
    },
    [userId, reload, mustQueue, upload],
  );

  const retry = useCallback(
    (localId: string) => {
      markPending(userId, localId);
      reload();
      void upload();
    },
    [userId, reload, upload],
  );

  const discard = useCallback(
    (localId: string) => {
      removeFromOutbox(userId, localId);
      reload();
    },
    [userId, reload],
  );

  const discardTank = useCallback(
    (tankId: string) => {
      discardLocalTank(userId, tankId);
      reload();
    },
    [userId, reload],
  );

  const value = useMemo<OutboxValue>(
    () => ({
      items,
      pendingCount: items.filter((item) => item.status === 'pending').length,
      failedCount: items.filter((item) => item.status === 'failed').length,
      uploading,
      lastError,
      uploadedCount,
      saveEntry,
      createTank,
      updateTank,
      uploadNow: () => void upload(),
      retry,
      discard,
      discardTank,
    }),
    [items, uploading, lastError, uploadedCount, saveEntry, createTank, updateTank, upload, retry, discard, discardTank],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxValue {
  const value = useContext(OutboxContext);
  if (!value) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return value;
}
