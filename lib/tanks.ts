import type { Database } from './database.types';
import { AppError, fromDbError, toAppError } from './errors';
import { strings } from './i18n';
import { getSupabase } from './supabase';
import { sortTanks } from './tankOverlay';
import type { VesselKind } from './vesselKinds';

export type { VesselKind };
export { VESSEL_KINDS } from './vesselKinds';

type TankRow = Omit<Database['public']['Tables']['tanks']['Row'], 'user_id'>;

export type Tank = {
  id: string;
  name: string;
  kind: VesselKind;
  /** Capacity of the vessel. */
  volumeLiters: number;
  /** Liters of wine in it now; null = not recorded. */
  contentLiters: number | null;
  variety: string | null;
  vintage: number | null;
  createdAt: string;
};

/** Validated values ready to be saved. */
export type TankInput = {
  name: string;
  kind: VesselKind;
  volumeLiters: number;
  contentLiters: number | null;
  variety: string | null;
  vintage: number | null;
};

const COLUMNS = 'id, name, kind, volume_liters, content_liters, variety, vintage, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(row: TankRow): Tank {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    volumeLiters: Number(row.volume_liters),
    contentLiters: row.content_liters === null ? null : Number(row.content_liters),
    variety: row.variety,
    vintage: row.vintage,
    createdAt: row.created_at,
  };
}

function toRow(input: TankInput) {
  return {
    name: input.name,
    kind: input.kind,
    volume_liters: input.volumeLiters,
    content_liters: input.contentLiters,
    variety: input.variety,
    vintage: input.vintage,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

function duplicateNameError(name: string, cause: unknown): AppError {
  return new AppError('validation', strings().messages.duplicateTank(name), {
    cause,
    field: 'name',
  });
}

/** All of the user's tanks, sorted so "Tank 2" comes before "Tank 12". */
export async function listTanks(): Promise<Tank[]> {
  try {
    const { data, error } = await getSupabase().from('tanks').select(COLUMNS);
    if (error) throw fromDbError(error, strings().messages.loadTanksFailed);
    return sortTanks(data.map(fromRow));
  } catch (error) {
    throw toAppError(error, strings().messages.loadTanksFailed);
  }
}

export async function getTank(id: string): Promise<Tank> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase()
      .from('tanks')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDbError(error, strings().messages.loadTankFailed);
    if (!data) throw new AppError('not_found', strings().messages.tankGone);
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.loadTankFailed);
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
      throw fromDbError(error, strings().messages.saveTankFailed);
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveTankFailed);
  }
}

/**
 * Deletes a tank. The database deletes its entries with it (ON DELETE CASCADE).
 * A tank that's already gone counts as deleted, so a retried upload is safe.
 */
export async function deleteTank(id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { error } = await getSupabase().from('tanks').delete().eq('id', id).select('id');
    if (error) throw fromDbError(error, strings().messages.deleteTankFailed);
  } catch (error) {
    throw toAppError(error, strings().messages.deleteTankFailed);
  }
}

export async function updateTank(id: string, input: TankInput): Promise<Tank> {
  if (!UUID.test(id)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase()
      .from('tanks')
      .update(toRow(input))
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') throw duplicateNameError(input.name, error);
      throw fromDbError(error, strings().messages.saveChangesFailed);
    }
    return fromRow(data);
  } catch (error) {
    throw toAppError(error, strings().messages.saveChangesFailed);
  }
}
