// Pure form logic for starting or editing a ferment (no network), so it can be unit-tested.
import type { FermentLike } from './fermentCurves';
import { strings } from './i18n';

/** Raw text from the form inputs. Dates are year-month-day ("2026-10-04"). */
export type FermentFormValues = {
  name: string;
  startDate: string;
  /** Empty = still running. */
  endDate: string;
};

export type FermentFormErrors = Partial<Record<keyof FermentFormValues | 'form', string>>;

/** What is saved: ISO times. */
export type FermentInput = {
  name: string;
  startedAt: string;
  endedAt: string | null;
};

const MAX_NAME = 100;

/** Local calendar day as "2026-10-04". */
export function dayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-10-04" -> local midnight that day, or null when it isn't a real date. */
export function parseDay(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // 2026-02-31 rolls over to March: not a real date.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Start from the vessel's grape and vintage ("Saperavi 2025"), starting today. */
export function newFermentForm(
  vessel: { variety: string | null; vintage: number | null },
  now: Date = new Date(),
): FermentFormValues {
  const name = [vessel.variety, vessel.vintage === null ? null : String(vessel.vintage)]
    .filter((part): part is string => part !== null && part !== '')
    .join(' ');
  return { name, startDate: dayString(now), endDate: '' };
}

export function fermentToForm(ferment: FermentLike): FermentFormValues {
  return {
    name: ferment.name,
    startDate: dayString(new Date(ferment.startedAt)),
    endDate: ferment.endedAt === null ? '' : dayString(new Date(ferment.endedAt)),
  };
}

/** The last moment of a local day, so an end date includes that whole day. */
function endOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}

/**
 * Checks the form. `others` are the vessel's other ferments (not this one): two
 * ferments in one vessel can't overlap, because the entries between the dates
 * belong to exactly one of them.
 */
export function validateFermentForm(
  values: FermentFormValues,
  others: readonly FermentLike[],
): { ok: true; input: FermentInput } | { ok: false; errors: FermentFormErrors } {
  const m = strings().messages;
  const errors: FermentFormErrors = {};

  const name = values.name.trim();
  if (name === '') errors.name = m.fermentNameRequired;
  else if (name.length > MAX_NAME) errors.name = m.fermentNameTooLong(MAX_NAME);

  const start = parseDay(values.startDate);
  if (!start) errors.startDate = m.fermentDateInvalid;

  const endText = values.endDate.trim();
  let end: Date | null = null;
  if (endText !== '') {
    const parsed = parseDay(endText);
    if (!parsed) errors.endDate = m.fermentDateInvalid;
    else end = endOfDay(parsed);
  }
  if (start && end && end.getTime() <= start.getTime()) errors.endDate = m.fermentEndBeforeStart;

  if (start && !errors.endDate) {
    const from = start.getTime();
    const to = end === null ? Infinity : end.getTime();
    const clash = others.find((other) => {
      const otherFrom = new Date(other.startedAt).getTime();
      const otherTo = other.endedAt === null ? Infinity : new Date(other.endedAt).getTime();
      return from < otherTo && otherFrom < to;
    });
    if (clash) errors.form = m.fermentOverlap(clash.name);
  }

  if (!start || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: { name, startedAt: start.toISOString(), endedAt: end === null ? null : end.toISOString() },
  };
}
