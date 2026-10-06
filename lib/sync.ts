// Saving changes when the connection may be gone, uploading the queue later,
// and keeping the offline copy of tanks and timelines up to date.
import { saveOfflineCopy } from './cache';
import { createEntry, listRecentEntries, TIMELINE_LIMIT } from './entries';
import type { ValidEntry } from './entryDraft';
import { toAppError } from './errors';
import {
  enqueue,
  enqueueTankCreate,
  enqueueTankUpdate,
  flushQueue,
  newLocalId,
  type FlushResult,
  type OutboxItem,
} from './outbox';
import { createTank, listTanks, updateTank, type TankInput } from './tanks';

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
    const appError = toAppError(error, 'Could not save.');
    if (appError.kind !== 'network') throw appError;
    queue();
    return 'queued';
  }
}

export function saveOrQueue(userId: string, entry: ValidEntry, queueOnly: boolean): Promise<SaveResult> {
  const meta = newMeta();
  return sendOrQueue(
    queueOnly,
    () => createEntry(entry, { id: meta.localId, createdAt: meta.createdAt }),
    () => enqueue(userId, entry, meta),
  );
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
 * Downloads the tank list and every timeline and saves them on the phone.
 * Two requests, whatever the number of tanks. Throws on failure (offline).
 */
export async function refreshOfflineCopy(userId: string): Promise<void> {
  const [tanks, entries] = await Promise.all([listTanks(), listRecentEntries()]);
  saveOfflineCopy(userId, tanks, entries, TIMELINE_LIMIT);
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
    case 'tank-create':
      await createTank(item.tank, { id: item.localId, createdAt: item.createdAt });
      return;
    case 'tank-update':
      await updateTank(item.tankId, item.tank);
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
