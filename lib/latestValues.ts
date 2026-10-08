// Pure logic for the tank screen's "Latest values": the newest reading of each value.
import { ANALYSIS_FIELDS } from './analysisForm';
import type { EntryType } from './entryTypes';
import type { ParsedItem } from './parser/schema';

type EntryLike = {
  type: EntryType;
  createdAt: string;
  parsed: { items: readonly ParsedItem[] };
};

export type LatestValue = { item: ParsedItem; createdAt: string };

/**
 * Readings that count even inside other entries ("added 20 g/hL SO2, temp
 * 22°C" is an addition, but the temperature is still a reading). A bare
 * "SO2" or "Volume" there is an amount added or moved, so it doesn't count.
 */
const READINGS = new Set(
  ['Free SO2', 'Total SO2', 'Temperature', 'pH', 'TA', 'VA', 'Alcohol', 'Brix', 'Residual sugar', 'Density', 'Malic acid'].map(
    (name) => name.toLowerCase(),
  ),
);

/** Analysis entries count in full, including the user's own fields. */
const ANALYSIS_TYPES: readonly EntryType[] = ['lab_analysis', 'temperature'];

const FIELD_ORDER = ANALYSIS_FIELDS.map((field) => field.name.toLowerCase());

/**
 * The newest value of each name (case-insensitive), in the Analysis form's
 * order, then the rest by how recently they were measured.
 */
export function latestValues(entries: readonly EntryLike[]): LatestValue[] {
  const newestFirst = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = new Map<string, LatestValue>();
  for (const entry of newestFirst) {
    const analysis = ANALYSIS_TYPES.includes(entry.type);
    for (const item of entry.parsed.items) {
      const key = item.name.trim().toLowerCase();
      if (key === '' || latest.has(key)) continue;
      if (analysis || READINGS.has(key)) latest.set(key, { item, createdAt: entry.createdAt });
    }
  }
  const rank = (key: string) => {
    const index = FIELD_ORDER.indexOf(key);
    return index === -1 ? FIELD_ORDER.length : index;
  };
  // Map order is newest-first, and sort is stable, so the rest stay newest first.
  return [...latest.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([, value]) => value);
}

/** What a tank card shows first: the readings that change day to day in the cellar. */
const CARD_PRIORITY = ['temperature', 'brix', 'density', 'free so2', 'ph', 'alcohol', 'va', 'ta', 'total so2', 'residual sugar'];

/** Up to `count` of the tank's latest readings for its card, most telling first. Numbers only. */
export function cardReadings(latest: readonly LatestValue[], count = 3): LatestValue[] {
  const byName = new Map(latest.map((value) => [value.item.name.trim().toLowerCase(), value]));
  return CARD_PRIORITY.map((name) => byName.get(name))
    .filter((value): value is LatestValue => value !== undefined && typeof value.item.value === 'number')
    .slice(0, count);
}
