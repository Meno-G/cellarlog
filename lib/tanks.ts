import type { Database } from './database.types';
import { AppError, fromDbError, toAppError } from './errors';
import { getSupabase } from './supabase';
import { sortTanks } from './tankOverlay';

type TankRow = Omit<Database['public']['Tables']['tanks']['Row'], 'user_id'>;

export type Tank = {
  id: string;
  name: string;
  volumeLiters: number;
  variety: string | null;
  vintage: number | null;
  createdAt: string;
};

/** Validated values ready to be saved. */
export type TankInput = {
  name: string;
  volumeLiters: number;
  variety: string | null;
  vintage: number | null;
};

const COLUMNS = 'id, name, volume_liters, variety, vintage, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(row: TankRow): Tank {
  return {
    id: row.id,
    name: row.name,
    volumeLiters: Number(row.volume_liters),
    variety: row.variety,
    vintage: row.vintage,
    createdAt: row.created_at,
  };
}

function toRow(input: TankInput) {
  return {
    name: input.name,
    volume_liters: input.volumeLiters,
    variety: input.variety,
    vintage: input.vintage,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

function duplicateNameError(name: string, cause: unknown): AppError {
  return new AppError('validation', `You already have a tank called "${name}".`, {
    cause,
    field: 'name',
  });
}

/** All of the user's tanks, sorted so "Tank 2" comes before "Tank 12". */
export async function listTanks(): Promise<Tank[]> {
  try {
    const { data, error } = await getSupabase().from('tanks').select(COLUMNS);
    if (error) throw fromDbError(error, 'Could not load your tanks.');
    return sortTanks(data.map(fromRow));
  } catch (error) {
    throw toAppError(error, 'Could not load your tanks.');
  }
}

export async function getTank(id: string): Promise<Tank> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That tank no longer exists.');
  try {
    const { data, error } = await getSupabase()
      .from('tanks')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDbError(error, 'Could not load this tank.');
    if (!data) throw new AppError('not_found', 'That tank no longer exists.');
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not load this tank.');
  }
}

/**
 * Creates a tank. `id` and `createdAt` come from the phone for tanks created
 * offline: entries queued for the tank already point at that id, and a retried
 * upload must not create a second tank.
 */
export async function createTank(
  input: TankInput,
  options: { id?: string; createdAt?: string } = {},
): Promise<Tank> {
  try {
    const { data, error } = await getSupabase()
      .from('tanks')
      .insert({
        ...toRow(input),
        ...(options.id ? { id: options.id } : {}),
        ...(options.createdAt ? { created_at: options.createdAt } : {}),
      })
      .select(COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') {
        // Same id: an earlier upload got through but its reply was lost.
        if (options.id && error.message.includes('tanks_pkey')) return await getTank(options.id);
        throw duplicateNameError(input.name, error);
      }
      throw fromDbError(error, 'Could not save the tank.');
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not save the tank.');
  }
}

/**
 * Deletes a tank. The database deletes its entries with it (ON DELETE CASCADE).
 * A tank that's already gone counts as deleted, so a retried upload is safe.
 */
export async function deleteTank(id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That tank no longer exists.');
  try {
    const { error } = await getSupabase().from('tanks').delete().eq('id', id).select('id');
    if (error) throw fromDbError(error, 'Could not delete the tank.');
  } catch (error) {
    throw toAppError(error, 'Could not delete the tank.');
  }
}

export async function updateTank(id: string, input: TankInput): Promise<Tank> {
  if (!UUID.test(id)) throw new AppError('not_found', 'That tank no longer exists.');
  try {
    const { data, error } = await getSupabase()
      .from('tanks')
      .update(toRow(input))
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') throw duplicateNameError(input.name, error);
      throw fromDbError(error, 'Could not save your changes.');
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, 'Could not save your changes.');
  }
}
