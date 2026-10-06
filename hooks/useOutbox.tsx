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
import { listOutbox, markPending, removeFromOutbox, type OutboxItem } from '@/lib/outbox';
import { flushOutbox, saveOrQueue, type SaveResult } from '@/lib/sync';

type OutboxValue = {
  /** Entries saved on this phone and not uploaded yet, oldest first. */
  items: OutboxItem[];
  /** Waiting for a connection (not counting failed ones). */
  pendingCount: number;
  failedCount: number;
  uploading: boolean;
  /** Message from the last upload attempt that was interrupted, or null. */
  lastError: string | null;
  /** Goes up each time queued entries reach the server, so timelines reload. */
  uploadedCount: number;
  /** Save now, or keep on the phone when offline. */
  saveEntry: (entry: ValidEntry) => Promise<SaveResult>;
  uploadNow: () => void;
  retry: (localId: string) => void;
  discard: (localId: string) => void;
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

  const upload = useCallback(async () => {
    if (!listOutbox(userId).some((item) => item.status === 'pending')) return;
    if (isOffline(await NetInfo.fetch())) return;
    setUploading(true);
    try {
      const result = await flushOutbox(userId);
      if (result.uploaded > 0) setUploadedCount((count) => count + result.uploaded);
      setLastError(result.interrupted ? 'Upload paused: no connection. It continues when you are back online.' : null);
    } catch (error) {
      setLastError(errorMessage(error));
    } finally {
      setUploading(false);
      reload();
    }
  }, [userId, reload]);

  // Upload on start, when the connection comes back, and when the app returns to the foreground.
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

  const saveEntry = useCallback(
    async (entry: ValidEntry): Promise<SaveResult> => {
      const result = await saveOrQueue(userId, entry, isOffline(await NetInfo.fetch()));
      reload();
      return result;
    },
    [userId, reload],
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

  const value = useMemo<OutboxValue>(
    () => ({
      items,
      pendingCount: items.filter((item) => item.status === 'pending').length,
      failedCount: items.filter((item) => item.status === 'failed').length,
      uploading,
      lastError,
      uploadedCount,
      saveEntry,
      uploadNow: () => void upload(),
      retry,
      discard,
    }),
    [items, uploading, lastError, uploadedCount, saveEntry, upload, retry, discard],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxValue {
  const value = useContext(OutboxContext);
  if (!value) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return value;
}
