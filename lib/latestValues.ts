// Pure logic for the tank screen's "Latest values" (the newest reading of each
// value) and each value's history.
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

/** Whether this value in this entry is a measurement of the tank (see READINGS). */
function isReading(type: EntryType, name: string): boolean {
  return ANALYSIS_TYPES.includes(type) || READINGS.has(name.trim().toLowerCase());
}

/**
 * The newest value of each name (case-insensitive), in the Analysis form's
 * order, then the rest by how recently they were measured.
 */
export function latestValues(entries: readonly EntryLike[]): LatestValue[] {
  const newestFirst = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = new Map<string, LatestValue>();
  for (const entry of newestFirst) {
    for (const item of entry.parsed.items) {
      const key = item.name.trim().toLowerCase();
      if (key === '' || latest.has(key)) continue;
      if (isReading(entry.type, item.name)) latest.set(key, { item, createdAt: entry.createdAt });
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

export type HistoryPoint = { value: number; unit: string | null; createdAt: string };

export type ValueHistory = {
  /** Every numeric reading of the value, oldest first. */
  points: HistoryPoint[];
  /** The unit most readings use; readings in another unit are left out of `points`. */
  unit: string | null;
  /** Readings that couldn't be compared: text, or another unit. */
  skipped: number;
};

/**
 * All readings of one value (case-insensitive name) on a tank, oldest first,
 * for its chart. Only readings in the most common unit are compared, so a
 * stray °F reading can't wreck a °C chart.
 */
export function valueHistory(entries: readonly EntryLike[], name: string): ValueHistory {
  const wanted = name.trim().toLowerCase();
  const all: { value: ParsedItem['value']; unit: string | null; createdAt: string }[] = [];
  for (const entry of entries) {
    for (const item of entry.parsed.items) {
      if (item.name.trim().toLowerCase() !== wanted || !isReading(entry.type, item.name)) continue;
      all.push({ value: item.value, unit: item.unit, createdAt: entry.createdAt });
    }
  }
  const numeric = all.filter(
    (reading): reading is HistoryPoint => typeof reading.value === 'number' && Number.isFinite(reading.value),
  );
  const unitCounts = new Map<string | null, number>();
  for (const reading of numeric) unitCounts.set(reading.unit, (unitCounts.get(reading.unit) ?? 0) + 1);
  let unit: string | null = null;
  let best = 0;
  for (const [candidate, count] of unitCounts) {
    if (count > best) {
      unit = candidate;
      best = count;
    }
  }
  const points = numeric
    .filter((reading) => reading.unit === unit)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { points, unit, skipped: all.length - points.length };
}
