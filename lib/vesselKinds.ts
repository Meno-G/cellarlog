// What a vessel is: a tank, a qvevri or a barrel. Pure, so the cache and the
// offline queue can use it without pulling in the network code.
import type { Database } from './database.types';

export type VesselKind = Database['public']['Enums']['vessel_kind'];

/** Order shown in the type picker. */
export const VESSEL_KINDS = ['tank', 'qvevri', 'barrel'] as const satisfies readonly VesselKind[];
