// Changes made on the phone while offline, waiting to be uploaded: new entries,
// new tanks and tank edits. Oldest first, so a tank created offline always
// uploads before the entries recorded for it.
// Pure apart from the key-value store (see ./storage.ts); uploading is in ./sync.ts.
import { z } from 'zod';

import type { ValidEntry } from './entryDraft';
import { ENTRY_TYPES } from './entryTypes';
import { toAppError } from './errors';
import { parsedEntrySchema } from './parser/schema';
import { getStore, userKey, writeJson } from './storage';
import type { TankInput } from './tanks';

const tankInputSchema = z.object({
  name: z.string(),
  volumeLiters: z.number(),
  variety: z.string().nullable(),
  vintage: z.number().nullable(),
}) satisfies z.ZodType<TankInput>;

const common = {
  /**
   * The row's id in the database (entry id, or the new tank's id), chosen on the
   * phone: a retried upload can't create a duplicate, and entries can point at
   * a tank that hasn't been uploaded yet.
   */
  localId: z.string(),
  /** When it happened on the phone; kept as the row's time after upload. */
  createdAt: z.string(),
  status: z.enum(['pending', 'failed']),
  /** Why the last upload failed for good (e.g. a duplicate tank name). */
  error: z.string().nullable(),
};

const entryItemSchema = z.object({
  kind: z.literal('entry'),
  tankId: z.string(),
  type: z.enum(ENTRY_TYPES),
  rawText: z.string(),
  parsed: parsedEntrySchema,
  ...common,
});

const tankCreateItemSchema = z.object({ kind: z.literal('tank-create'), tank: tankInputSchema, ...common });

const tankUpdateItemSchema = z.object({
  kind: z.literal('tank-update'),
  tankId: z.string(),
  tank: tankInputSchema,
  ...common,
});

const tankDeleteItemSchema = z.object({ kind: z.literal('tank-delete'), tankId: z.string(), ...common });

const outboxItemSchema = z.preprocess(
  // Items saved before tanks could be queued have no `kind`: they are entries.
  (value) =>
    typeof value === 'object' && value !== null && !('kind' in value) ? { ...value, kind: 'entry' } : value,
  z.discriminatedUnion('kind', [
    entryItemSchema,
    tankCreateItemSchema,
    tankUpdateItemSchema,
    tankDeleteItemSchema,
  ]),
);

export type OutboxItem = z.infer<typeof outboxItemSchema>;
export type EntryItem = z.infer<typeof entryItemSchema>;
export type TankCreateItem = z.infer<typeof tankCreateItemSchema>;
export type TankUpdateItem = z.infer<typeof tankUpdateItemSchema>;
export type TankDeleteItem = z.infer<typeof tankDeleteItemSchema>;

const outboxKey = (userId: string) => userKey(userId, 'outbox');

/** Oldest first, the order they happened and should be uploaded in. */
export function listOutbox(userId: string): OutboxItem[] {
  try {
    const text = getStore().getItem(outboxKey(userId));
    if (text === null) return [];
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return [];
    // Item by item: one unreadable item must not hide the others.
    const items: OutboxItem[] = [];
    for (const value of raw) {
      const parsed = outboxItemSchema.safeParse(value);
      if (parsed.success) items.push(parsed.data);
    }
    return items;
  } catch {
    return [];
  }
}

function save(userId: string, items: OutboxItem[]): void {
  if (!writeJson(outboxKey(userId), items)) {
    throw new Error('Could not save on this phone. The phone storage may be full.');
  }
}

function append(userId: string, item: OutboxItem): OutboxItem {
  const items = listOutbox(userId).filter((existing) => existing.localId !== item.localId);
  save(userId, [...items, item]);
  return item;
}

type Meta = { localId: string; createdAt: string };

export function enqueue(userId: string, entry: ValidEntry, meta: Meta): EntryItem {
  const item: EntryItem = {
    kind: 'entry',
    tankId: entry.tankId,
    type: entry.type,
    rawText: entry.rawText,
    parsed: entry.parsed,
    ...meta,
    status: 'pending',
    error: null,
  };
  append(userId, item);
  return item;
}

/** `meta.localId` becomes the new tank's id. */
export function enqueueTankCreate(userId: string, tank: TankInput, meta: Meta): TankCreateItem {
  const item: TankCreateItem = { kind: 'tank-create', tank, ...meta, status: 'pending', error: null };
  append(userId, item);
  return item;
}

/**
 * Queues an edit. A tank that is still waiting to be created just gets its
 * queued values replaced; a second edit of the same tank replaces the first.
 */
export function enqueueTankUpdate(userId: string, tankId: string, tank: TankInput, meta: Meta): OutboxItem {
  const items = listOutbox(userId);
  const create = items.find(
    (item): item is TankCreateItem => item.kind === 'tank-create' && item.localId === tankId,
  );
  if (create) {
    const merged: OutboxItem = { ...create, tank, status: 'pending', error: null };
    save(userId, items.map((item) => (item === create ? merged : item)));
    return merged;
  }
  const others = items.filter((item) => !(item.kind === 'tank-update' && item.tankId === tankId));
  const update: TankUpdateItem = { kind: 'tank-update', tankId, tank, ...meta, status: 'pending', error: null };
  save(userId, [...others, update]);
  return update;
}

/**
 * Queues deleting a tank. Anything else queued for that tank is dropped, since
 * the database deletes its entries anyway. A tank that only exists on this
 * phone is simply discarded (nothing to delete on the server): returns null.
 */
export function enqueueTankDelete(userId: string, tankId: string, meta: Meta): TankDeleteItem | null {
  const items = listOutbox(userId);
  if (isLocalTank(items, tankId)) {
    discardLocalTank(userId, tankId);
    return null;
  }
  const others = items.filter((item) => item.kind === 'tank-create' || item.tankId !== tankId);
  const item: TankDeleteItem = { kind: 'tank-delete', tankId, ...meta, status: 'pending', error: null };
  save(userId, [...others, item]);
  return item;
}

/** Drops queued entries and edits for a tank that was deleted on the server. */
export function dropQueuedForTank(userId: string, tankId: string): void {
  save(
    userId,
    listOutbox(userId).filter((item) => item.kind === 'tank-create' || item.tankId !== tankId),
  );
}

/** True while a tank exists only on this phone (its creation hasn't uploaded yet). */
export function isLocalTank(items: readonly OutboxItem[], tankId: string): boolean {
  return items.some((item) => item.kind === 'tank-create' && item.localId === tankId);
}

export function removeFromOutbox(userId: string, localId: string): void {
  save(userId, listOutbox(userId).filter((item) => item.localId !== localId));
}

/** Discards a tank created offline together with the entries queued for it. */
export function discardLocalTank(userId: string, tankId: string): void {
  save(
    userId,
    listOutbox(userId).filter(
      (item) =>
        !(item.kind === 'tank-create' && item.localId === tankId) &&
        !(item.kind !== 'tank-create' && item.tankId === tankId),
    ),
  );
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
  /** Changes that can't be uploaded as they are (shown to the user to fix or delete). */
  failed: number;
  /** Stopped early because the connection (or the login) dropped; the rest stays queued. */
  interrupted: boolean;
};

/**
 * Uploads pending changes oldest first with `upload` (which throws on failure).
 * No connection, or an expired login, stops the run and keeps everything
 * queued. Any other error marks just that change as failed and moves on.
 * Changes to a tank that hasn't been created on the server yet wait for it.
 */
export async function flushQueue(
  userId: string,
  upload: (item: OutboxItem) => Promise<void>,
): Promise<FlushResult> {
  const result: FlushResult = { uploaded: 0, failed: 0, interrupted: false };
  const tanksNotCreated = new Set<string>();
  for (const item of listOutbox(userId)) {
    if (item.status !== 'pending') {
      if (item.kind === 'tank-create') tanksNotCreated.add(item.localId);
      continue;
    }
    if (item.kind !== 'tank-create' && tanksNotCreated.has(item.tankId)) continue;
    try {
      await upload(item);
      removeFromOutbox(userId, item.localId);
      result.uploaded++;
    } catch (error) {
      const appError = toAppError(error, 'Could not upload.');
      if (appError.kind === 'network' || appError.kind === 'auth') {
        result.interrupted = true;
        break;
      }
      markFailed(userId, item.localId, appError.message);
      if (item.kind === 'tank-create') tanksNotCreated.add(item.localId);
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
