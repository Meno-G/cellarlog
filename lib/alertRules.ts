// Alert rules a winemaker sets per vessel, and how they are checked. Pure: the
// checks run on the phone against the running ferment's readings, so they work
// offline. An alert only states what was observed and which rule tripped; it
// never says what is wrong or what to do (that is the winemaker's decision).
import { z } from 'zod';

import type { EntryType } from './entryTypes';
import { activeFerment, fermentCurves, type CurvePoint, type FermentLike } from './fermentCurves';
import { strings } from './i18n';
import { parseNumber } from './numbers';
import type { ParsedItem } from './parser/schema';

export const ALERT_KINDS = ['density_stall', 'temperature_range'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

const HOUR_MS = 3_600_000;

// ---- Rules ----------------------------------------------------------------------

export const densityStallParamsSchema = z.object({
  /** Look back this many hours. */
  hours: z.number().int().min(1).max(720),
  /** The density must have fallen by at least this much over those hours. */
  minDrop: z.number().positive(),
  /** At or below this density the ferment counts as finished: no alert. */
  dryBelow: z.number(),
});

export const temperatureRangeParamsSchema = z
  .object({ minC: z.number().min(-20).max(100), maxC: z.number().min(-20).max(100) })
  .refine((p) => p.minC < p.maxC);

export type DensityStallParams = z.infer<typeof densityStallParamsSchema>;
export type TemperatureRangeParams = z.infer<typeof temperatureRangeParamsSchema>;

export type AlertRule =
  | { kind: 'density_stall'; enabled: boolean; params: DensityStallParams }
  | { kind: 'temperature_range'; enabled: boolean; params: TemperatureRangeParams };

/** Reads a stored rule; anything that doesn't fit (edited by hand, an older shape) is dropped. */
export function parseRule(kind: string, enabled: boolean, params: unknown): AlertRule | null {
  if (kind === 'density_stall') {
    const parsed = densityStallParamsSchema.safeParse(params);
    return parsed.success ? { kind, enabled, params: parsed.data } : null;
  }
  if (kind === 'temperature_range') {
    const parsed = temperatureRangeParamsSchema.safeParse(params);
    return parsed.success ? { kind, enabled, params: parsed.data } : null;
  }
  return null;
}

// ---- Defaults (starting values only, not winemaking advice) ---------------------------

/**
 * Densities are written as 1.060 or as 1060; the defaults follow whichever the
 * winemaker uses (`sample` is a density reading, if there is one).
 */
export function densityDefaults(sample?: number): DensityStallParams {
  return sample !== undefined && sample > 10
    ? { hours: 48, minDrop: 2, dryBelow: 998 }
    : { hours: 48, minDrop: 0.002, dryBelow: 0.998 };
}

export const TEMPERATURE_DEFAULTS: TemperatureRangeParams = { minC: 18, maxC: 30 };

// ---- Checking ---------------------------------------------------------------------------

type EntryLike = {
  type: EntryType;
  createdAt: string;
  parsed: { items: readonly ParsedItem[] };
};

export type Reading = { value: number; at: string; unit: string | null };

export type AlertStatus = 'tripped' | 'ok' | 'no-data';

/** Why a rule could not say anything, or why it's fine. */
export type AlertReason =
  | 'no-ferment' // nothing is running
  | 'no-readings' // the ferment has no reading of that value yet
  | 'too-early' // no reading is old enough to compare with
  | 'no-new-reading' // nothing newer than the one to compare with
  | 'unit' // temperature not in °C
  | 'dry'; // below the "finished" density

export type AlertResult = {
  rule: AlertRule;
  status: AlertStatus;
  reason?: AlertReason;
  /** Density: the reading `hours` ago (or the nearest older one). */
  from?: Reading;
  /** The newest reading that was checked. */
  latest?: Reading;
};

function reading(point: CurvePoint, unit: string | null): Reading {
  return { value: point.value, at: point.at, unit };
}

function checkDensity(
  rule: Extract<AlertRule, { kind: 'density_stall' }>,
  ferment: FermentLike,
  entries: readonly EntryLike[],
  now: Date,
): AlertResult {
  const curves = fermentCurves(entries, [ferment], 'Density', now);
  const points = curves.series[0]?.points ?? [];
  const last = points[points.length - 1];
  if (!last) return { rule, status: 'no-data', reason: 'no-readings' };
  const latest = reading(last, curves.unit);
  if (last.value <= rule.params.dryBelow) return { rule, status: 'ok', reason: 'dry', latest };

  // The newest reading that is at least `hours` old is what today's value is compared with.
  const cutoff = now.getTime() - rule.params.hours * HOUR_MS;
  const base = [...points].reverse().find((point) => new Date(point.at).getTime() <= cutoff);
  if (!base) return { rule, status: 'no-data', reason: 'too-early', latest };
  if (base.at === last.at) return { rule, status: 'no-data', reason: 'no-new-reading', latest };

  const from = reading(base, curves.unit);
  // Rounded so 0.002 is not missed by floating-point noise.
  const dropped = Math.round((base.value - last.value) * 1e6) / 1e6;
  return { rule, status: dropped < rule.params.minDrop ? 'tripped' : 'ok', from, latest };
}

function checkTemperature(
  rule: Extract<AlertRule, { kind: 'temperature_range' }>,
  ferment: FermentLike,
  entries: readonly EntryLike[],
  now: Date,
): AlertResult {
  const curves = fermentCurves(entries, [ferment], 'Temperature', now);
  const points = curves.series[0]?.points ?? [];
  const last = points[points.length - 1];
  if (!last) return { rule, status: 'no-data', reason: 'no-readings' };
  if (curves.unit !== '°C') return { rule, status: 'no-data', reason: 'unit', latest: reading(last, curves.unit) };
  const latest = reading(last, curves.unit);
  const outside = last.value < rule.params.minC || last.value > rule.params.maxC;
  return { rule, status: outside ? 'tripped' : 'ok', latest };
}

/**
 * Checks the enabled rules against the vessel's running ferment. `ferments` are
 * the vessel's; `entries` its timeline (with changes still waiting to upload).
 */
export function evaluateRules(
  rules: readonly AlertRule[],
  entries: readonly EntryLike[],
  ferments: readonly FermentLike[],
  now: Date = new Date(),
): AlertResult[] {
  const running = activeFerment(ferments);
  const results: AlertResult[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!running) results.push({ rule, status: 'no-data', reason: 'no-ferment' });
    else if (rule.kind === 'density_stall') results.push(checkDensity(rule, running, entries, now));
    else results.push(checkTemperature(rule, running, entries, now));
  }
  return results;
}

export function trippedAlerts(results: readonly AlertResult[]): AlertResult[] {
  return results.filter((result) => result.status === 'tripped');
}

// ---- Rule forms --------------------------------------------------------------------------

export type DensityFormValues = { hours: string; minDrop: string; dryBelow: string };
export type TemperatureFormValues = { minC: string; maxC: string };

export const densityToForm = (p: DensityStallParams): DensityFormValues => ({
  hours: String(p.hours),
  minDrop: String(p.minDrop),
  dryBelow: String(p.dryBelow),
});

export const temperatureToForm = (p: TemperatureRangeParams): TemperatureFormValues => ({
  minC: String(p.minC),
  maxC: String(p.maxC),
});

function number(text: string): number | null {
  const value = parseNumber(text);
  return value === null || Number.isNaN(value) ? null : value;
}

export function validateDensityForm(
  values: DensityFormValues,
): { ok: true; params: DensityStallParams } | { ok: false; errors: Partial<Record<keyof DensityFormValues, string>> } {
  const m = strings().messages;
  const errors: Partial<Record<keyof DensityFormValues, string>> = {};
  const hours = number(values.hours);
  if (hours === null || !Number.isInteger(hours) || hours < 1 || hours > 720) errors.hours = m.alertHoursRange;
  const minDrop = number(values.minDrop);
  if (minDrop === null || minDrop <= 0) errors.minDrop = m.alertPositive;
  const dryBelow = number(values.dryBelow);
  if (dryBelow === null) errors.dryBelow = m.alertNumber;
  if (Object.keys(errors).length > 0 || hours === null || minDrop === null || dryBelow === null) return { ok: false, errors };
  return { ok: true, params: { hours, minDrop, dryBelow } };
}

export function validateTemperatureForm(
  values: TemperatureFormValues,
): { ok: true; params: TemperatureRangeParams } | { ok: false; errors: Partial<Record<keyof TemperatureFormValues, string>> } {
  const m = strings().messages;
  const errors: Partial<Record<keyof TemperatureFormValues, string>> = {};
  const minC = number(values.minC);
  const maxC = number(values.maxC);
  if (minC === null || minC < -20 || minC > 100) errors.minC = m.alertTemperatureRange;
  if (maxC === null || maxC < -20 || maxC > 100) errors.maxC = m.alertTemperatureRange;
  if (!errors.minC && !errors.maxC && minC !== null && maxC !== null && minC >= maxC) errors.maxC = m.alertMinBelowMax;
  if (Object.keys(errors).length > 0 || minC === null || maxC === null) return { ok: false, errors };
  return { ok: true, params: { minC, maxC } };
}
