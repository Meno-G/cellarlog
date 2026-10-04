import type { Database } from './database.types';

export type EntryType = Database['public']['Enums']['entry_type'];

/** Order shown in the type picker. Must list every value of the entry_type enum. */
export const ENTRY_TYPES = [
  'addition',
  'temperature',
  'lab_analysis',
  'tasting',
  'transfer',
  'note',
] as const satisfies readonly EntryType[];

// Compile-time check that ENTRY_TYPES covers the whole database enum.
type Missing = Exclude<EntryType, (typeof ENTRY_TYPES)[number]>;
const allTypesListed: Missing extends never ? true : false = true;
void allTypesListed;

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  addition: 'Addition',
  temperature: 'Temperature',
  lab_analysis: 'Lab analysis',
  tasting: 'Tasting',
  transfer: 'Transfer',
  note: 'Note',
};
