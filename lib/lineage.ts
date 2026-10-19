// Where a vessel's wine came from and where it went, followed through the
// transfer entries the vessels keep about each other (they name each other by
// name). A vessel that was deleted has no timeline, so the chain stops there.
// Pure.
import type { EntryType } from './entryTypes';
import type { ParsedItem } from './parser/schema';

type EntryLike = {
  type: EntryType;
  createdAt: string;
  parsed: { items: readonly ParsedItem[] };
};

export type LineageStep = {
  /** The vessel the wine came from (or went to). */
  vessel: string;
  /** Liters moved, when recorded. */
  liters: number | null;
  at: string;
  /** What the wine in that vessel had come from before this step. */
  from: LineageStep[];
};

const key = (name: string) => name.trim().toLowerCase();

function transferPart(entry: EntryLike, itemName: 'Source' | 'Destination'): { vessel: string; liters: number | null } | null {
  if (entry.type !== 'transfer') return null;
  const other = entry.parsed.items.find((item) => item.name === itemName);
  if (!other || typeof other.value !== 'string' || other.value.trim() === '') return null;
  const volume = entry.parsed.items.find((item) => item.name === 'Volume');
  const liters =
    volume && typeof volume.value === 'number' ? (volume.unit === 'hL' ? volume.value * 100 : volume.value) : null;
  return { vessel: other.value.trim(), liters };
}

/**
 * The wine that came into this vessel, newest step first, and, for each step, what
 * had come into the source vessel before that moment (up to `depth` steps back).
 * `timelines` maps a vessel's name (lower case) to its entries.
 */
export function cameFrom(
  vessel: string,
  timelines: ReadonlyMap<string, readonly EntryLike[]>,
  options: { before?: string; depth?: number } = {},
): LineageStep[] {
  const { before, depth = 4 } = options;
  if (depth <= 0) return [];
  return (timelines.get(key(vessel)) ?? [])
    .filter((entry) => before === undefined || entry.createdAt < before)
    .flatMap((entry) => {
      const part = transferPart(entry, 'Source');
      return part ? [{ ...part, at: entry.createdAt }] : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((step) => ({ ...step, from: cameFrom(step.vessel, timelines, { before: step.at, depth: depth - 1 }) }));
}

/** Where wine went from this vessel, newest first. */
export function wentTo(entries: readonly EntryLike[]): Omit<LineageStep, 'from'>[] {
  return entries
    .flatMap((entry) => {
      const part = transferPart(entry, 'Destination');
      return part ? [{ ...part, at: entry.createdAt }] : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}
