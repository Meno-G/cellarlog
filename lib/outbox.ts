// Entries saved on the phone while offline, waiting to be uploaded.
// Pure apart from the key-value store (see ./storage.ts); uploading is in ./sync.ts.
import { z } from 'zod';

import type { ValidEntry } from './entryDraft';
import { ENTRY_TYPES } from './entryTypes';
import { toAppError } from './errors';
import { parsedEntrySchema } from './parser/schema';
import { readJson, userKey, writeJson } from './storage';

const outboxItemSchema = z.object({
  /** Becomes the entry's id in the database, so a retried upload can't create a duplicate. */
  localId: z.string(),
  tankId: z.string(),
  type: z.enum(ENTRY_TYPES),
  rawText: z.string(),
  parsed: parsedEntrySchema,
  /** When it was recorded on the phone; kept as the entry's time after upload. */
  createdAt: z.string(),
  status: z.enum(['pending', 'failed']),
  /** Why the last upload failed for good (e.g. the tank was deleted). */
  error: z.string().nullable(),
});

export type OutboxItem = z.infer<typeof outboxItemSchema>;

const outboxSchema = z.array(outboxItemSchema);
const outboxKey = (userId: string) => userKey(userId, 'outbox');

/** Oldest first, the order they were recorded and should be uploaded in. */
export function listOutbox(userId: string): OutboxItem[] {
  return readJson(outboxKey(userId), outboxSchema) ?? [];
}

function save(userId: string, items: OutboxItem[]): void {
  if (!writeJson(outboxKey(userId), items)) {
    throw new Error('Could not save the entry on this phone. The phone storage may be full.');
  }
}

export function enqueue(
  userId: string,
  entry: ValidEntry,
  meta: { localId: string; createdAt: string },
): OutboxItem {
  const item: OutboxItem = {
    localId: meta.localId,
    tankId: entry.tankId,
    type: entry.type,
    rawText: entry.rawText,
    parsed: entry.parsed,
    createdAt: meta.createdAt,
    status: 'pending',
    error: null,
  };
  const items = listOutbox(userId).filter((existing) => existing.localId !== item.localId);
  save(userId, [...items, item]);
  return item;
}

export function removeFromOutbox(userId: string, localId: string): void {
  save(userId, listOutbox(userId).filter((item) => item.localId !== localId));
}

export function markFailed(userId: string, localId: string, error: string): void {
  save(
    userId,
    listOutbox(userId).map((item) =>
      item.localId === localId ? { ...item, status: 'failed', error } : item,
    ),
  );
}

export function markPending(userId: string, localId: string): void {
  save(
    userId,
    listOutbox(userId).map((item) =>
      item.localId === localId ? { ...item, status: 'pending', error: null } : item,
    ),
  );
}

export type FlushResult = {
  uploaded: number;
  /** Entries that can't be uploaded as they are (shown to the user to fix or delete). */
  failed: number;
  /** Stopped early because the connection (or the login) dropped; the rest stays queued. */
  interrupted: boolean;
};

/**
 * Uploads pending entries oldest first with `upload` (which throws on failure).
 * No connection, or an expired login, stops the run and keeps everything
 * queued. Any other error marks just that entry as failed and moves on.
 */
export async function flushQueue(
  userId: string,
  upload: (item: OutboxItem) => Promise<void>,
): Promise<FlushResult> {
  const result: FlushResult = { uploaded: 0, failed: 0, interrupted: false };
  for (const item of listOutbox(userId)) {
    if (item.status !== 'pending') continue;
    try {
      await upload(item);
      removeFromOutbox(userId, item.localId);
      result.uploaded++;
    } catch (error) {
      const appError = toAppError(error, 'Could not upload the entry.');
      if (appError.kind === 'network' || appError.kind === 'auth') {
        result.interrupted = true;
        break;
      }
      markFailed(userId, item.localId, appError.message);
      result.failed++;
    }
  }
  return result;
}

/** A UUID v4. Only an idempotency key (never a secret), so Math.random is an acceptable fallback. */
export function newLocalId(): string {
  const cryptoApi: Crypto | undefined = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
