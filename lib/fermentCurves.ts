// Pure logic for ferments: which ferment is running, which entries belong to
// which ferment, and the curves (value against days since the start) that the
// fermentation chart draws and compares.
//
// A ferment is a vessel plus a start and an optional end date. The entries
// recorded between those dates belong to it (there is no link column).
import type { EntryType } from './entryTypes';
import { isReading } from './latestValues';
import type { ParsedItem } from './parser/schema';

const DAY_MS = 86_400_000;

export type FermentLike = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
};

type EntryLike = {
  type: EntryType;
  createdAt: string;
  parsed: { items: readonly ParsedItem[] };
};

/** The running ferment (no end date). If several are open, the newest. */
export function activeFerment<T extends FermentLike>(ferments: readonly T[]): T | undefined {
  return [...ferments]
    .filter((ferment) => ferment.endedAt === null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/** Days since the start, with fractions: 2.5 = two and a half days in. */
export function elapsedDays(startedAt: string, at: string | Date): number {
  return (new Date(at).getTime() - new Date(startedAt).getTime()) / DAY_MS;
}

/** "Day 1" is the start day. For display ("day 12"). */
export function fermentDay(startedAt: string, at: string | Date): number {
  return Math.max(1, Math.floor(elapsedDays(startedAt, at)) + 1);
}

/** Entries recorded while the ferment ran, oldest first. */
export function entriesInFerment<T extends { createdAt: string }>(
  entries: readonly T[],
  ferment: FermentLike,
  now: Date = new Date(),
): T[] {
  const from = new Date(ferment.startedAt).getTime();
  const to = ferment.endedAt === null ? now.getTime() : new Date(ferment.endedAt).getTime();
  return entries
    .filter((entry) => {
      const at = new Date(entry.createdAt).getTime();
      return at >= from && at <= to;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type CurvePoint = { day: number; value: number; at: string };

export type CurveSeries<T extends FermentLike> = {
  ferment: T;
  /** Oldest first. */
  points: CurvePoint[];
  /** The ferment being looked at: the running one, or else the newest. */
  current: boolean;
};

export type Curves<T extends FermentLike> = {
  /** The current ferment first, then earlier ones, newest first. Ferments without readings are left out. */
  series: CurveSeries<T>[];
  /** The unit most readings use; readings in another unit are left out. */
  unit: string | null;
  /** Readings left out: text, or another unit. */
  skipped: number;
  maxDay: number;
  min: number;
  max: number;
};

/**
 * One curve per ferment for one measured value (for example "Density"), each
 * in days since its own start, so ferments of different years line up.
 */
export function fermentCurves<T extends FermentLike>(
  entries: readonly EntryLike[],
  ferments: readonly T[],
  name: string,
  now: Date = new Date(),
): Curves<T> {
  const wanted = name.trim().toLowerCase();
  const currentId = (activeFerment(ferments) ?? [...ferments].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0])?.id;

  type Raw = { ferment: T; value: number; unit: string | null; at: string };
  const raw: Raw[] = [];
  let skipped = 0;
  for (const ferment of ferments) {
    for (const entry of entriesInFerment(entries, ferment, now)) {
      for (const item of entry.parsed.items) {
        if (item.name.trim().toLowerCase() !== wanted || !isReading(entry.type, item.name)) continue;
        if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
          skipped++;
          continue;
        }
        raw.push({ ferment, value: item.value, unit: item.unit, at: entry.createdAt });
      }
    }
  }

  // Only readings in the most common unit are drawn, so one stray unit can't wreck a curve.
  const counts = new Map<string | null, number>();
  for (const reading of raw) counts.set(reading.unit, (counts.get(reading.unit) ?? 0) + 1);
  let unit: string | null = null;
  let best = 0;
  for (const [candidate, count] of counts) {
    if (count > best) {
      unit = candidate;
      best = count;
    }
  }
  const used = raw.filter((reading) => reading.unit === unit);
  skipped += raw.length - used.length;

  const series: CurveSeries<T>[] = [];
  for (const ferment of ferments) {
    const points = used
      .filter((reading) => reading.ferment.id === ferment.id)
      .map((reading) => ({ day: Math.max(0, elapsedDays(ferment.startedAt, reading.at)), value: reading.value, at: reading.at }))
      .sort((a, b) => a.day - b.day);
    if (points.length > 0) series.push({ ferment, points, current: ferment.id === currentId });
  }
  series.sort((a, b) => Number(b.current) - Number(a.current) || b.ferment.startedAt.localeCompare(a.ferment.startedAt));

  const values = used.map((reading) => reading.value);
  const days = series.flatMap((s) => s.points.map((p) => p.day));
  return {
    series,
    unit,
    skipped,
    maxDay: Math.max(1, Math.ceil(Math.max(0, ...days))),
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

export type DayComparison<T extends FermentLike> = {
  /** Display day ("day 5") of the current ferment's newest reading. */
  day: number;
  now: CurvePoint;
  /** Each earlier ferment's reading closest to that day (within a day), if it has one. */
  earlier: { ferment: T; point: CurvePoint }[];
};

/**
 * The newest reading of the current ferment next to what each earlier ferment
 * read around the same day. Null when the current ferment has no reading.
 */
export function compareAtDay<T extends FermentLike>(curves: Curves<T>, window = 1): DayComparison<T> | null {
  const current = curves.series.find((s) => s.current);
  const now = current?.points[current.points.length - 1];
  if (!current || !now) return null;
  const earlier: DayComparison<T>['earlier'] = [];
  for (const other of curves.series) {
    if (other.current) continue;
    let nearest: CurvePoint | undefined;
    for (const point of other.points) {
      if (Math.abs(point.day - now.day) > window) continue;
      if (!nearest || Math.abs(point.day - now.day) < Math.abs(nearest.day - now.day)) nearest = point;
    }
    if (nearest) earlier.push({ ferment: other.ferment, point: nearest });
  }
  return { day: Math.floor(now.day) + 1, now, earlier };
}
