// SO2 calculator: how much of the free SO2 in a wine is the protective molecular
// form at its pH, how much free SO2 reaches a chosen molecular target, and how
// much potassium metabisulfite (KMBS) that takes in a given volume. A calculation
// the winemaker steers with the target, not advice. Pure.
import { strings } from './i18n';
import { parseNumber } from './numbers';

/** pKa of the first dissociation of sulfurous acid at about 20 °C. */
const PKA = 1.81;
/** KMBS is about 57% SO2 by weight. */
const KMBS_SO2_SHARE = 0.57;

/** The share of free SO2 that is molecular at this pH (about 6% at pH 3.5). */
export function molecularFraction(ph: number): number {
  return 1 / (1 + 10 ** (ph - PKA));
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export type So2Plan = {
  /** Molecular SO2 in the wine now (mg/L). */
  molecularNow: number;
  /** Free SO2 that gives the target molecular SO2 at this pH (mg/L). */
  neededFree: number;
  /** Free SO2 still to add (mg/L); 0 when the wine is already at or above the target. */
  toAddMgL: number;
  /** The same as grams of SO2 per hectoliter (1 mg/L = 0.1 g/hL). */
  toAddGHl: number;
  /** Grams of KMBS for the whole volume; null when the volume isn't given. */
  kmbsGrams: number | null;
};

/** Free SO2 in mg/L, target molecular SO2 in mg/L, volume in liters (or null). */
export function so2Plan(ph: number, freeSo2: number, target: number, liters: number | null): So2Plan {
  const fraction = molecularFraction(ph);
  const neededFree = target / fraction;
  const toAdd = Math.max(0, neededFree - freeSo2);
  return {
    molecularNow: Math.round(freeSo2 * fraction * 100) / 100,
    neededFree: round1(neededFree),
    toAddMgL: round1(toAdd),
    toAddGHl: Math.round(toAdd * 0.1 * 100) / 100,
    kmbsGrams: liters === null ? null : round1((toAdd * liters) / 1000 / KMBS_SO2_SHARE),
  };
}

export type So2FormValues = { ph: string; free: string; target: string; liters: string };
export type So2Errors = Partial<Record<keyof So2FormValues, string>>;

/** Checks the typed values; the volume is optional. */
export function so2FromForm(values: So2FormValues): { ok: true; plan: So2Plan } | { ok: false; errors: So2Errors } {
  const m = strings().messages;
  const errors: So2Errors = {};
  const number = (text: string): number | null | undefined => {
    if (text.trim() === '') return undefined;
    const parsed = parseNumber(text);
    return parsed === null || Number.isNaN(parsed) ? null : parsed;
  };

  const ph = number(values.ph);
  if (ph === undefined || ph === null || ph < 2.5 || ph > 4.5) errors.ph = m.so2PhRange;
  const free = number(values.free);
  if (free === undefined || free === null || free < 0 || free > 500) errors.free = m.so2FreeRange;
  const target = number(values.target);
  if (target === undefined || target === null || target < 0.1 || target > 2) errors.target = m.so2TargetRange;
  const liters = number(values.liters);
  if (liters === null || (liters !== undefined && (liters <= 0 || liters > 999_999_999))) errors.liters = m.volumePositive;

  if (Object.keys(errors).length > 0 || ph === undefined || ph === null || free === undefined || free === null || target === undefined || target === null) {
    return { ok: false, errors };
  }
  return { ok: true, plan: so2Plan(ph, free, target, liters ?? null) };
}
