// Saving entries when the connection may be gone, and uploading the queue later.
import { createEntry } from './entries';
import type { ValidEntry } from './entryDraft';
import { toAppError } from './errors';
import { enqueue, flushQueue, newLocalId, type FlushResult } from './outbox';

export type SaveResult = 'saved' | 'queued';
export type { FlushResult };

/**
 * Saves an entry to Supabase, or keeps it on the phone when there is no
 * connection. Other errors (e.g. the tank was deleted) are thrown as usual.
 */
export async function saveOrQueue(
  userId: string,
  entry: ValidEntry,
  knownOffline: boolean,
): Promise<SaveResult> {
  const meta = { localId: newLocalId(), createdAt: new Date().toISOString() };
  if (knownOffline) {
    enqueue(userId, entry, meta);
    return 'queued';
  }
  try {
    await createEntry(entry, { id: meta.localId, createdAt: meta.createdAt });
    return 'saved';
  } catch (error) {
    const appError = toAppError(error, 'Could not save the entry.');
    if (appError.kind === 'network') {
      enqueue(userId, entry, meta);
      return 'queued';
    }
    throw appError;
  }
}

let running: Promise<FlushResult> | null = null;

/** Uploads queued entries, oldest first. Only one upload runs at a time. */
export function flushOutbox(userId: string): Promise<FlushResult> {
  running ??= flushQueue(userId, async (item) => {
    // The phone's id makes this idempotent: a retry after a lost reply is not a duplicate.
    await createEntry(
      { tankId: item.tankId, type: item.type, rawText: item.rawText, parsed: item.parsed },
      { id: item.localId, createdAt: item.createdAt },
    );
  }).finally(() => {
    running = null;
  });
  return running;
}
