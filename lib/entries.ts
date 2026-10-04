import type { ValidEntry } from './entryDraft';
import type { EntryType } from './entryTypes';
import { AppError, fromDbError, toAppError } from './errors';
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
const TIMELINE_LIMIT = 200;
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
  if (!UUID.test(tankId)) throw new AppError('not_found', 'That tank no longer exists.');
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .select(COLUMNS)
      .eq('tank_id', tankId)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_LIMIT);
    if (error) throw fromDbError(error, 'Could not load the timeline.');
    return data.map(fromRow);
  } catch (error) {
    throw toAppError(error, 'Could not load the timeline.');
  }
}

export async function deleteEntry(id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That entry no longer exists.');
  try {
    const { data, error } = await getSupabase().from('entries').delete().eq('id', id).select('id');
    if (error) throw fromDbError(error, 'Could not delete the entry.');
    // RLS hides other users' rows, so "nothing deleted" means it's already gone.
    if (data.length === 0) throw new AppError('not_found', 'That entry was already deleted.');
  } catch (error) {
    throw toAppError(error, 'Could not delete the entry.');
  }
}

export async function getEntry(id: string): Promise<Entry> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That entry no longer exists.');
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDbError(error, 'Could not load the entry.');
    if (!data) throw new AppError('not_found', 'That entry no longer exists.');
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not load the entry.');
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
    return new AppError('not_found', 'That tank no longer exists. Pick another tank.', {
      cause: error,
      field: 'tank',
    });
  }
  return fromDbError(error, fallback);
}

export async function createEntry(entry: ValidEntry): Promise<Entry> {
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .insert(toRow(entry))
      .select(COLUMNS)
      .single();
    if (error) throw saveError(error, 'Could not save the entry.');
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not save the entry.');
  }
}

/** Saves edits to an entry. The original note (raw_text) is kept as it was. */
export async function updateEntry(id: string, entry: ValidEntry): Promise<Entry> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That entry no longer exists.');
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .update(toRow(entry))
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw saveError(error, 'Could not save your changes.');
    if (!data) throw new AppError('not_found', 'That entry was deleted in the meantime.');
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not save your changes.');
  }
}
