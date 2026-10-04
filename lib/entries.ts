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

export async function createEntry(entry: ValidEntry): Promise<Entry> {
  try {
    const { data, error } = await getSupabase()
      .from('entries')
      .insert({
        tank_id: entry.tankId,
        type: entry.type,
        raw_text: entry.rawText,
        parsed: entry.parsed,
      })
      .select(COLUMNS)
      .single();
    if (error) {
      if (error.code === '23503' || error.code === '42501') {
        // Foreign key / RLS: the tank was deleted or isn't the user's.
        throw new AppError('not_found', 'That tank no longer exists. Pick another tank.', {
          cause: error,
          field: 'tank',
        });
      }
      throw fromDbError(error, 'Could not save the entry.');
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not save the entry.');
  }
}
