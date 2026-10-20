// Saving changes when the connection may be gone, uploading the queue later,
// and keeping the offline copy of tanks and timelines up to date.
import { removeEntryFromCache, removeTankFromCache, saveOfflineCopy } from './cache';
import {
  createEntry,
  deleteEntry,
  listRecentEntries,
  TIMELINE_LIMIT,
  updateEntry,
  type Entry,
} from './entries';
import type { ValidEntry } from './entryDraft';
import { AppError, toAppError } from './errors';
import { strings } from './i18n';
import {
  discardLocalTank,
  dropQueuedForEntry,
  dropQueuedForTank,
  enqueue,
  enqueueEntryDelete,
  enqueueEntryUpdate,
  enqueueTankCreate,
  enqueueFermentDelete,
  enqueueFermentSave,
  enqueueTankDelete,
  enqueueTankUpdate,
  flushQueue,
  isLocalEntry,
  isLocalTank,
  listOutbox,
  newLocalId,
  type FlushResult,
  type OutboxItem,
} from './outbox';
import { listAllRules } from './alerts';
import { createFerment, deleteFerment, listAllFerments, updateFerment } from './ferments';
import { createTank, deleteTank, listTanks, updateTank, type TankInput } from './tanks';
import type { FermentInput } from './fermentForm';

export type SaveResult = 'saved' | 'queued';
export type { FlushResult };

const newMeta = () => ({ localId: newLocalId(), createdAt: new Date().toISOString() });

/**
 * Runs `send` now, or queues the change when there is no connection (or when
 * it depends on a tank that only exists on this phone so far). Other errors
 * (a duplicate tank name, a deleted tank) are thrown as usual.
 */
async function sendOrQueue(
  queueOnly: boolean,
  send: () => Promise<unknown>,
  queue: () => void,
): Promise<SaveResult> {
  if (queueOnly) {
    queue();
    return 'queued';
  }
  try {
    await send();
    return 'saved';
  } catch (error) {
    const appError = toAppError(error, strings().messages.couldNotSave);
    if (appError.kind !== 'network') throw appError;
    queue();
    return 'queued';
  }
}

/** `createdAt` keeps an earlier recording time (entries carried over to another vessel). */
export function saveOrQueue(
  userId: string,
  entry: ValidEntry,
  queueOnly: boolean,
  createdAt?: string,
): Promise<SaveResult> {
  const meta = { ...newMeta(), ...(createdAt ? { createdAt } : {}) };
  return sendOrQueue(
    queueOnly,
    () => createEntry(entry, { id: meta.localId, createdAt: meta.createdAt }),
    () => enqueue(userId, entry, meta),
  );
}

/**
 * Saves an edit now, or queues it. Queued when offline, and also when changes
 * to this entry (or its new tank) are still waiting, so they upload in order.
 */
export function updateEntryOrQueue(
  userId: string,
  saved: Pick<Entry, 'id' | 'createdAt'>,
  entry: ValidEntry,
  queueOnly: boolean,
): Promise<SaveResult> {
  return sendOrQueue(
    queueOnly,
    () => updateEntry(saved.id, entry),
    () => enqueueEntryUpdate(userId, saved, entry, newMeta()),
  );
}

/** An entry that's already gone counts as deleted, so a retried upload is safe. */
async function deleteEntryIfThere(id: string): Promise<void> {
  try {
    await deleteEntry(id);
  } catch (error) {
    if (!(error instanceof AppError && error.kind === 'not_found')) throw error;
  }
}

/**
 * Deletes an entry now, or queues it. An entry that never uploaded is just
 * removed from the queue. Either way it leaves this phone's saved timeline.
 */
export async function deleteEntryOrQueue(
  userId: string,
  saved: Pick<Entry, 'id' | 'tankId'>,
  queueOnly: boolean,
): Promise<SaveResult> {
  if (isLocalEntry(listOutbox(userId), saved.id)) {
    enqueueEntryDelete(userId, saved, newMeta());
    return 'saved';
  }
  const result = await sendOrQueue(
    queueOnly,
    () => deleteEntryIfThere(saved.id),
    () => enqueueEntryDelete(userId, saved, newMeta()),
  );
  removeEntryFromCache(userId, saved.tankId, saved.id);
  if (result === 'saved') dropQueuedForEntry(userId, saved.id);
  return result;
}

/** Creates a tank now or queues it. The id is chosen here, so it's known either way. */
export async function createTankOrQueue(
  userId: string,
  tank: TankInput,
  queueOnly: boolean,
): Promise<{ id: string; result: SaveResult }> {
  const meta = newMeta();
  const result = await sendOrQueue(
    queueOnly,
    () => createTank(tank, { id: meta.localId, createdAt: meta.createdAt }),
    () => enqueueTankCreate(userId, tank, meta),
  );
  return { id: meta.localId, result };
}

export function updateTankOrQueue(
  userId: string,
  tankId: string,
  tank: TankInput,
  queueOnly: boolean,
): Promise<SaveResult> {
  return sendOrQueue(
    queueOnly,
    () => updateTank(tankId, tank),
    () => enqueueTankUpdate(userId, tankId, tank, newMeta()),
  );
}

/**
 * Deletes a tank (and, in the database, its entries) now, or queues it.
 * A tank that only exists on this phone is just discarded with its queued entries.
 */
export async function deleteTankOrQueue(
  userId: string,
  tankId: string,
  queueOnly: boolean,
): Promise<SaveResult> {
  if (isLocalTank(listOutbox(userId), tankId)) {
    discardLocalTank(userId, tankId);
    return 'saved';
  }
  const result = await sendOrQueue(
    queueOnly,
    () => deleteTank(tankId),
    () => enqueueTankDelete(userId, tankId, newMeta()),
  );
  // Either way it's gone from this phone's saved copy. Changes still queued for it
  // could never upload (its entries are deleted with it), so they go too.
  removeTankFromCache(userId, tankId);
  if (result === 'saved') dropQueuedForTank(userId, tankId);
  return result;
}

/**
 * Starts or changes a ferment now, or queues it. `fermentId` null = a new one (its id is chosen
 * here, so it's known either way). Queued when offline, when its tank only exists on this phone,
 * and when earlier changes to it are still waiting.
 */
export async function saveFermentOrQueue(
  userId: string,
  tankId: string,
  fermentId: string | null,
  input: FermentInput,
  queueOnly: boolean,
): Promise<{ id: string; result: SaveResult }> {
  const meta = newMeta();
  const id = fermentId ?? meta.localId;
  const result = await sendOrQueue(
    queueOnly,
    () => (fermentId === null ? createFerment(tankId, input, { id, createdAt: meta.createdAt }) : updateFerment(id, input)),
    () => enqueueFermentSave(userId, tankId, id, input, fermentId === null, meta),
  );
  return { id, result };
}

/** Already gone counts as deleted, so a retried upload is safe. */
async function deleteFermentIfThere(id: string): Promise<void> {
  try {
    await deleteFerment(id);
  } catch (error) {
    if (!(error instanceof AppError && error.kind === 'not_found')) throw error;
  }
}

/** Deletes a ferment (its entries stay on the timeline) now, or queues it. */
export function deleteFermentOrQueue(userId: string, tankId: string, fermentId: string, queueOnly: boolean): Promise<SaveResult> {
  return sendOrQueue(
    queueOnly,
    () => deleteFermentIfThere(fermentId),
    () => enqueueFermentDelete(userId, tankId, fermentId, newMeta()),
  );
}

/**
 * Downloads the tank list, every timeline, ferment and alert rule and saves them on
 * the phone. Four requests, whatever the number of tanks. Throws on failure (offline).
 */
export async function refreshOfflineCopy(userId: string): Promise<void> {
  const [tanks, entries, ferments, rules] = await Promise.all([
    listTanks(),
    listRecentEntries(),
    listAllFerments(),
    listAllRules(),
  ]);
  saveOfflineCopy(userId, tanks, entries, TIMELINE_LIMIT, ferments, rules);
}

/** Sends one queued change. The ids chosen on the phone make every retry safe. */
async function uploadItem(item: OutboxItem): Promise<void> {
  switch (item.kind) {
    case 'entry':
      await createEntry(
        { tankId: item.tankId, type: item.type, rawText: item.rawText, parsed: item.parsed },
        { id: item.localId, createdAt: item.createdAt },
      );
      return;
    case 'entry-update':
      await updateEntry(item.entryId, {
        tankId: item.tankId,
        type: item.type,
        rawText: item.rawText,
        parsed: item.parsed,
      });
      return;
    case 'entry-delete':
      await deleteEntryIfThere(item.entryId);
      return;
    case 'tank-create':
      await createTank(item.tank, { id: item.localId, createdAt: item.createdAt });
      return;
    case 'tank-update':
      await updateTank(item.tankId, item.tank);
      return;
    case 'tank-delete':
      await deleteTank(item.tankId);
      return;
    case 'ferment-save':
      await createFerment(item.tankId, item.input, { id: item.fermentId, createdAt: item.createdAt });
      return;
    case 'ferment-delete':
      await deleteFermentIfThere(item.fermentId);
      return;
  }
}

let running: Promise<FlushResult> | null = null;

/** Uploads queued changes, oldest first. Only one upload runs at a time. */
export function flushOutbox(userId: string): Promise<FlushResult> {
  running ??= flushQueue(userId, uploadItem).finally(() => {
    running = null;
  });
  return running;
}
