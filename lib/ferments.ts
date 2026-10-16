// Ferments in Supabase. See fermentCurves.ts for what a ferment is.
// Reading works offline from the saved copy (lib/cache.ts); starting, editing and
// deleting a ferment needs a connection.
import type { Database } from './database.types';
import { AppError, fromDbError, toAppError } from './errors';
import type { FermentInput } from './fermentForm';
import { strings } from './i18n';
import { getSupabase } from './supabase';

type FermentRow = Omit<Database['public']['Tables']['ferments']['Row'], 'user_id'>;

export type Ferment = {
  id: string;
  tankId: string;
  name: string;
  startedAt: string;
  /** Null while the ferment is still running. */
  endedAt: string | null;
  createdAt: string;
};

export type { FermentInput };

const COLUMNS = 'id, tank_id, name, started_at, ended_at, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(row: FermentRow): Ferment {
  return {
    id: row.id,
    tankId: row.tank_id,
    name: row.name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

function toRow(input: FermentInput) {
  return { name: input.name, started_at: input.startedAt, ended_at: input.endedAt };
}

/** Newest first. */
function sortNewestFirst(ferments: Ferment[]): Ferment[] {
  return [...ferments].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** One vessel's ferments, newest first. */
export async function listFerments(tankId: string): Promise<Ferment[]> {
  if (!UUID.test(tankId)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase().from('ferments').select(COLUMNS).eq('tank_id', tankId);
    if (error) throw fromDbError(error, strings().messages.loadFermentsFailed);
    return sortNewestFirst(data.map(fromRow));
  } catch (error) {
    throw toAppError(error, strings().messages.loadFermentsFailed);
  }
}

/** Every ferment of the user (RLS limits it to theirs), for the offline copy. */
export async function listAllFerments(): Promise<Ferment[]> {
  try {
    const { data, error } = await getSupabase().from('ferments').select(COLUMNS);
    if (error) throw fromDbError(error, strings().messages.loadFermentsFailed);
    return sortNewestFirst(data.map(fromRow));
  } catch (error) {
    throw toAppError(error, strings().messages.loadFermentsFailed);
  }
}

export async function createFerment(tankId: string, input: FermentInput): Promise<Ferment> {
  if (!UUID.test(tankId)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase()
      .from('ferments')
      .insert({ tank_id: tankId, ...toRow(input) })
      .select(COLUMNS)
      .single();
    if (error) throw fromDbError(error, strings().messages.saveFermentFailed);
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveFermentFailed);
  }
}

export async function updateFerment(id: string, input: FermentInput): Promise<Ferment> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.fermentGone);
  try {
    const { data, error } = await getSupabase()
      .from('ferments')
      .update(toRow(input))
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw fromDbError(error, strings().messages.saveFermentFailed);
    if (!data) throw new AppError('not_found', strings().messages.fermentGone);
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveFermentFailed);
  }
}

/** Deletes only the ferment; its entries stay on the timeline. Already gone counts as deleted. */
export async function deleteFerment(id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.fermentGone);
  try {
    const { error } = await getSupabase().from('ferments').delete().eq('id', id);
    if (error) throw fromDbError(error, strings().messages.deleteFermentFailed);
  } catch (error) {
    throw toAppError(error, strings().messages.deleteFermentFailed);
  }
}
