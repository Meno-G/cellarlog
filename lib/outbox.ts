// Changes made on the phone while offline, waiting to be uploaded: new, edited
// and deleted entries, and new, edited and deleted tanks. Oldest first, so a tank created offline always
// uploads before the entries recorded for it.
// Pure apart from the key-value store (see ./storage.ts); uploading is in ./sync.ts.
import { z } from 'zod';

import type { ValidEntry } from './entryDraft';
import { blendSchema } from './blend';
import { ENTRY_TYPES } from './entryTypes';
import { toAppError } from './errors';
import { strings } from './i18n';
import { parsedEntrySchema } from './parser/schema';
import { getStore, removeKey, userKey, writeJson } from './storage';
import type { TankInput } from './tanks';
import { VESSEL_KINDS } from './vesselKinds';

const tankInputSchema = z.object({
  name: z.string(),
  // Changes queued before vessel kinds existed are plain tanks.
  kind: z.enum(VESSEL_KINDS).catch('tank'),
  volumeLiters: z.number(),
  // Changes queued before the amount of wine was recorded have none.
  contentLiters: z.number().nullable().catch(null),
  blend: blendSchema,
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

/** An edit of an entry that is already on the server. `tankId` is the tank it belongs to after the edit. */
const entryUpdateItemSchema = z.object({
  kind: z.literal('entry-update'),
  entryId: z.string(),
  /** When the entry itself was recorded (its place in the timeline). */
  entryCreatedAt: z.string(),
  tankId: z.string(),
  type: z.enum(ENTRY_TYPES),
  rawText: z.string(),
  parsed: parsedEntrySchema,
  ...common,
});

const entryDeleteItemSchema = z.object({
  kind: z.literal('entry-delete'),
  entryId: z.string(),
  tankId: z.string(),
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

/** Starting or changing a ferment. `fermentId` is chosen on the phone for a new one; `isNew`: not on the server yet. */
const fermentSaveItemSchema = z.object({
  kind: z.literal('ferment-save'),
  tankId: z.string(),
  fermentId: z.string(),
  isNew: z.boolean(),
  input: z.object({ name: z.string(), startedAt: z.string(), endedAt: z.string().nullable() }),
  ...common,
});

const fermentDeleteItemSchema = z.object({
  kind: z.literal('ferment-delete'),
  tankId: z.string(),
  fermentId: z.string(),
  ...common,
});

/** Saving an alert rule (one per kind per vessel); the newest one wins. */
const ruleSaveItemSchema = z.object({
  kind: z.literal('rule-save'),
  tankId: z.string(),
  ruleKind: z.enum(['density_stall', 'temperature_range']),
  enabled: z.boolean(),
  params: z.record(z.string(), z.number()),
  ...common,
});

const outboxItemSchema = z.preprocess(
  // Items saved before tanks could be queued have no `kind`: they are entries.
  (value) =>
    typeof value === 'object' && value !== null && !('kind' in value) ? { ...value, kind: 'entry' } : value,
  z.discriminatedUnion('kind', [
    entryItemSchema,
    entryUpdateItemSchema,
    entryDeleteItemSchema,
    tankCreateItemSchema,
    tankUpdateItemSchema,
    tankDeleteItemSchema,
    fermentSaveItemSchema,
    fermentDeleteItemSchema,
    ruleSaveItemSchema,
  ]),
);

export type OutboxItem = z.infer<typeof outboxItemSchema>;
export type EntryItem = z.infer<typeof entryItemSchema>;
export type EntryUpdateItem = z.infer<typeof entryUpdateItemSchema>;
export type EntryDeleteItem = z.infer<typeof entryDeleteItemSchema>;
export type TankCreateItem = z.infer<typeof tankCreateItemSchema>;
export type TankUpdateItem = z.infer<typeof tankUpdateItemSchema>;
export type TankDeleteItem = z.infer<typeof tankDeleteItemSchema>;
export type FermentSaveItem = z.infer<typeof fermentSaveItemSchema>;
export type FermentDeleteItem = z.infer<typeof fermentDeleteItemSchema>;
export type RuleSaveItem = z.infer<typeof ruleSaveItemSchema>;

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
    throw new Error(strings().messages.storageFull);
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

/** True while an entry exists only on this phone (it hasn't uploaded yet). */
export function isLocalEntry(items: readonly OutboxItem[], entryId: string): boolean {
  return items.some((item) => item.kind === 'entry' && item.localId === entryId);
}

/** True when changes to this entry are still queued: new changes must wait behind them. */
export function hasQueuedEntryChanges(items: readonly OutboxItem[], entryId: string): boolean {
  return items.some(
    (item) =>
      (item.kind === 'entry' && item.localId === entryId) ||
      ((item.kind === 'entry-update' || item.kind === 'entry-delete') && item.entryId === entryId),
  );
}

/**
 * Queues an edit. An entry that hasn't uploaded yet just gets its queued values
 * replaced (it keeps its id and recording time); a second edit replaces the first.
 */
export function enqueueEntryUpdate(
  userId: string,
  saved: { id: string; createdAt: string },
  entry: ValidEntry,
  meta: Meta,
): OutboxItem {
  const items = listOutbox(userId);
  const fields = { tankId: entry.tankId, type: entry.type, rawText: entry.rawText, parsed: entry.parsed };
  const create = items.find((item): item is EntryItem => item.kind === 'entry' && item.localId === saved.id);
  if (create) {
    const merged: EntryItem = { ...create, ...fields, status: 'pending', error: null };
    save(userId, items.map((item) => (item === create ? merged : item)));
    return merged;
  }
  const others = items.filter((item) => !(item.kind === 'entry-update' && item.entryId === saved.id));
  const update: EntryUpdateItem = {
    kind: 'entry-update',
    entryId: saved.id,
    entryCreatedAt: saved.createdAt,
    ...fields,
    ...meta,
    status: 'pending',
    error: null,
  };
  save(userId, [...others, update]);
  return update;
}

/**
 * Queues deleting an entry; queued edits of it are dropped. An entry that never
 * uploaded is simply removed from the queue (nothing to delete on the server): returns null.
 */
export function enqueueEntryDelete(
  userId: string,
  saved: { id: string; tankId: string },
  meta: Meta,
): EntryDeleteItem | null {
  const items = listOutbox(userId);
  if (isLocalEntry(items, saved.id)) {
    save(userId, items.filter((item) => !(item.kind === 'entry' && item.localId === saved.id)));
    return null;
  }
  const others = items.filter(
    (item) => !((item.kind === 'entry-update' || item.kind === 'entry-delete') && item.entryId === saved.id),
  );
  const item: EntryDeleteItem = {
    kind: 'entry-delete',
    entryId: saved.id,
    tankId: saved.tankId,
    ...meta,
    status: 'pending',
    error: null,
  };
  save(userId, [...others, item]);
  return item;
}

/** Drops queued edits of an entry (after it was deleted directly on the server). */
export function dropQueuedForEntry(userId: string, entryId: string): void {
  save(
    userId,
    listOutbox(userId).filter(
      (item) => !((item.kind === 'entry-update' || item.kind === 'entry-delete') && item.entryId === entryId),
    ),
  );
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

/** True when changes to this ferment are still queued: new ones must wait behind them. */
export function hasQueuedFermentChanges(items: readonly OutboxItem[], fermentId: string): boolean {
  return items.some((item) => (item.kind === 'ferment-save' || item.kind === 'ferment-delete') && item.fermentId === fermentId);
}

/**
 * Queues starting or changing a ferment. A second change of the same ferment replaces the
 * first (a ferment that never uploaded stays new).
 */
export function enqueueFermentSave(
  userId: string,
  tankId: string,
  fermentId: string,
  input: FermentSaveItem['input'],
  isNew: boolean,
  meta: Meta,
): FermentSaveItem {
  const items = listOutbox(userId);
  const earlier = items.find((item): item is FermentSaveItem => item.kind === 'ferment-save' && item.fermentId === fermentId);
  const others = items.filter((item) => !((item.kind === 'ferment-save' || item.kind === 'ferment-delete') && item.fermentId === fermentId));
  const item: FermentSaveItem = {
    kind: 'ferment-save',
    tankId,
    fermentId,
    isNew: earlier?.isNew ?? isNew,
    input,
    localId: earlier?.localId ?? meta.localId,
    createdAt: earlier?.createdAt ?? meta.createdAt,
    status: 'pending',
    error: null,
  };
  save(userId, [...others, item]);
  return item;
}

/** Queues deleting a ferment. One that never uploaded is just removed from the queue: returns null. */
export function enqueueFermentDelete(userId: string, tankId: string, fermentId: string, meta: Meta): FermentDeleteItem | null {
  const items = listOutbox(userId);
  const earlier = items.find((item): item is FermentSaveItem => item.kind === 'ferment-save' && item.fermentId === fermentId);
  const others = items.filter((item) => !((item.kind === 'ferment-save' || item.kind === 'ferment-delete') && item.fermentId === fermentId));
  if (earlier?.isNew) {
    save(userId, others);
    return null;
  }
  const item: FermentDeleteItem = { kind: 'ferment-delete', tankId, fermentId, ...meta, status: 'pending', error: null };
  save(userId, [...others, item]);
  return item;
}

/** True when a change to this rule is still queued: a new one must wait behind it. */
export function hasQueuedRuleChanges(items: readonly OutboxItem[], tankId: string, ruleKind: string): boolean {
  return items.some((item) => item.kind === 'rule-save' && item.tankId === tankId && item.ruleKind === ruleKind);
}

/** Queues saving a rule; a second save of the same rule replaces the first. */
export function enqueueRuleSave(
  userId: string,
  tankId: string,
  rule: { kind: 'density_stall' | 'temperature_range'; enabled: boolean; params: Record<string, number> },
  meta: Meta,
): RuleSaveItem {
  const items = listOutbox(userId);
  const earlier = items.find((item): item is RuleSaveItem => item.kind === 'rule-save' && item.tankId === tankId && item.ruleKind === rule.kind);
  const others = items.filter((item) => item !== earlier);
  const item: RuleSaveItem = {
    kind: 'rule-save',
    tankId,
    ruleKind: rule.kind,
    enabled: rule.enabled,
    params: { ...rule.params },
    localId: earlier?.localId ?? meta.localId,
    createdAt: earlier?.createdAt ?? meta.createdAt,
    status: 'pending',
    error: null,
  };
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

/** Throws away everything queued for this user (after their account was deleted). */
export function clearOutbox(userId: string): void {
  removeKey(outboxKey(userId));
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
      const appError = toAppError(error, strings().messages.couldNotUpload);
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
