import type { ValidEntry } from './entryDraft';
import type { EntryType } from './entryTypes';
import { AppError, fromDbError, toAppError } from './errors';
import { strings } from './i18n';
import { parsedEntrySchema, type ParsedEntry } from './parser/schema';
import { getSupabase } from './supabase';

export type Entry = {
  id: string;
  tankId: string;
  type: EntryType;
  rawText: string;
  parsed: ParsedEntry;
  createdAt: string;
};

const COLUMNS = 'id, tank_id, type, raw_text, parsed, created_at';
/** Entries kept per tank on the screen and on the phone (Supabase answers at most 1000 rows per request). */
export const TIMELINE_LIMIT = 1000;
/** Entries across all tanks kept on the phone for offline use. */
const OFFLINE_ENTRIES = 10_000;
const PAGE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EntryRow = {
  id: string;
  tank_id: string;
  type: EntryType;
  raw_text: string;
  parsed: unknown;
  created_at: string;
};

function fromRow(row: EntryRow): Entry {
  // Rows are written by this app, but validate anyway: a row edited by hand
  // in the dashboard should not crash the timeline.
  const parsed = parsedEntrySchema.safeParse(row.parsed);
  return {
    id: row.id,
    tankId: row.tank_id,
    type: row.type,
    rawText: row.raw_text,
    parsed: parsed.success
      ? parsed.data
      : { tank_name: null, type: row.type, items: [], note: row.raw_text },
    createdAt: row.created_at,
  };
}

/** A tank's timeline, newest first. */
export async function listEntries(tankId: string): Promise<Entry[]> {
  if (!UUID.test(tankId)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .select(COLUMNS)
      .eq('tank_id', tankId)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_LIMIT);
    if (error) throw fromDbError(error, strings().messages.loadTimelineFailed);
    return data.map(fromRow);
  } catch (error) {
    throw toAppError(error, strings().messages.loadTimelineFailed);
  }
}

/**
 * The user's most recent entries across all tanks (RLS limits it to theirs),
 * newest first. Used to save every timeline on the phone for offline use. The
 * server answers at most 1000 rows at a time, so it reads page after page.
 */
export async function listRecentEntries(limit = OFFLINE_ENTRIES): Promise<Entry[]> {
  try {
    const entries: Entry[] = [];
    while (entries.length < limit) {
      const from = entries.length;
      const { data, error } = await getSupabase()
        .from('entries')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .order('id') // a stable order, so no entry is skipped or repeated between pages
        .range(from, Math.min(from + PAGE, limit) - 1);
      if (error) throw fromDbError(error, strings().messages.loadEntriesFailed);
      entries.push(...data.map(fromRow));
      if (data.length < PAGE) break;
    }
    return entries;
  } catch (error) {
    throw toAppError(error, strings().messages.loadEntriesFailed);
  }
}

export async function deleteEntry(id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.entryGone);
  try {
    const { data, error } = await getSupabase().from('entries').delete().eq('id', id).select('id');
    if (error) throw fromDbError(error, strings().messages.deleteEntryFailed);
    // RLS hides other users' rows, so "nothing deleted" means it's already gone.
    if (data.length === 0) throw new AppError('not_found', strings().messages.entryAlreadyDeleted);
  } catch (error) {
    throw toAppError(error, strings().messages.deleteEntryFailed);
  }
}

export async function getEntry(id: string): Promise<Entry> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.entryGone);
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDbError(error, strings().messages.loadEntryFailed);
    if (!data) throw new AppError('not_found', strings().messages.entryGone);
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.loadEntryFailed);
  }
}

function toRow(entry: ValidEntry) {
  return {
    tank_id: entry.tankId,
    type: entry.type,
    raw_text: entry.rawText,
    parsed: entry.parsed,
  };
}

/** Foreign key / RLS failures on tank_id mean the chosen tank is gone or not the user's. */
function saveError(error: { code: string; message: string }, fallback: string): AppError {
  if (error.code === '23503' || error.code === '42501') {
    return new AppError('not_found', strings().messages.tankGonePickAnother, {
      cause: error,
      field: 'tank',
    });
  }
  return fromDbError(error, fallback);
}

/**
 * Saves a new entry. `id` and `createdAt` come from the phone for entries that
 * were queued offline: the id makes a retried upload idempotent, and the time
 * keeps the moment it was recorded rather than the moment it was uploaded.
 */
export async function createEntry(
  entry: ValidEntry,
  options: { id?: string; createdAt?: string } = {},
): Promise<Entry> {
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .insert({
        ...toRow(entry),
        ...(options.id ? { id: options.id } : {}),
        ...(options.createdAt ? { created_at: options.createdAt } : {}),
      })
      .select(COLUMNS)
      .single();
    if (error) {
      // Same id already there: an earlier upload got through but its reply was lost.
      if (error.code === '23505' && options.id) return await getEntry(options.id);
      throw saveError(error, strings().messages.saveEntryFailed);
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveEntryFailed);
  }
}

/** Saves edits to an entry. The original note (raw_text) is kept as it was. */
export async function updateEntry(id: string, entry: ValidEntry): Promise<Entry> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.entryGone);
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .update(toRow(entry))
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw saveError(error, strings().messages.saveChangesFailed);
    if (!data) throw new AppError('not_found', strings().messages.entryDeletedMeanwhile);
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveChangesFailed);
  }
}
