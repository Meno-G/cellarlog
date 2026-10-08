// Shows entry changes made on the phone before they reach the server: new
// entries appear in the timeline, edits replace the old values, deletions hide
// the entry. Pure: no network, no storage.
import type { Entry } from './entries';
import type { OutboxItem } from './outbox';

export type EntryUpload = {
  status: 'pending' | 'failed';
  error: string | null;
  /** What is waiting: a new entry, an edit, or a deletion. */
  action: 'create' | 'edit' | 'delete';
  /** The queued change (to retry or discard it). */
  localId: string;
};

/** An entry as shown in the timeline, plus its upload state when it has unsent changes. */
export type ShownEntry = Entry & { upload: EntryUpload | null };

const uploadOf = (item: OutboxItem, action: EntryUpload['action']): EntryUpload => ({
  status: item.status,
  error: item.error,
  action,
  localId: item.localId,
});

/**
 * One entry with its queued changes applied (to open it for editing), or
 * undefined when it doesn't exist or is waiting to be deleted.
 */
export function applyChangesToEntry(
  saved: Entry | undefined,
  items: readonly OutboxItem[],
  entryId: string,
): ShownEntry | undefined {
  let shown: ShownEntry | undefined = saved ? { ...saved, upload: null } : undefined;
  for (const item of items) {
    if (item.kind === 'entry' && item.localId === entryId) {
      const { tankId, type, rawText, parsed, createdAt } = item;
      shown = { id: entryId, tankId, type, rawText, parsed, createdAt, upload: uploadOf(item, 'create') };
    } else if (item.kind === 'entry-update' && item.entryId === entryId) {
      const { tankId, type, rawText, parsed, entryCreatedAt } = item;
      shown = { id: entryId, tankId, type, rawText, parsed, createdAt: entryCreatedAt, upload: uploadOf(item, 'edit') };
    } else if (item.kind === 'entry-delete' && item.entryId === entryId && item.status === 'pending') {
      shown = undefined;
    }
  }
  return shown;
}

/**
 * One tank's timeline, newest first: the saved entries (server or cached copy)
 * with the queued changes for this tank applied in the order they were made.
 */
export function applyEntryChanges(
  saved: readonly Entry[],
  items: readonly OutboxItem[],
  tankId: string,
): ShownEntry[] {
  const shown = new Map<string, ShownEntry>(
    saved.filter((entry) => entry.tankId === tankId).map((entry) => [entry.id, { ...entry, upload: null }]),
  );
  for (const item of items) {
    if (item.kind === 'entry') {
      // Once uploaded it also comes back from the server; until it leaves the queue, show it once.
      if (item.tankId !== tankId) continue;
      shown.set(item.localId, {
        id: item.localId,
        tankId: item.tankId,
        type: item.type,
        rawText: item.rawText,
        parsed: item.parsed,
        createdAt: item.createdAt,
        upload: uploadOf(item, 'create'),
      });
    } else if (item.kind === 'entry-update') {
      if (item.tankId !== tankId) {
        // Moved to another tank: it leaves this timeline.
        shown.delete(item.entryId);
        continue;
      }
      shown.set(item.entryId, {
        id: item.entryId,
        tankId: item.tankId,
        type: item.type,
        rawText: item.rawText,
        parsed: item.parsed,
        createdAt: item.entryCreatedAt,
        upload: uploadOf(item, 'edit'),
      });
    } else if (item.kind === 'entry-delete') {
      const current = shown.get(item.entryId);
      if (!current) continue;
      // Deleted on the phone: gone at once. Only a delete that failed for good shows again, marked.
      if (item.status === 'pending') shown.delete(item.entryId);
      else shown.set(item.entryId, { ...current, upload: uploadOf(item, 'delete') });
    }
  }
  return [...shown.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
