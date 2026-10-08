// Pure logic for the "Analysis" tab: a fixed list of labelled fields plus
// fields the user adds by name. It saves the same shape as a parsed note.
import { newDraftItem, type DraftItem, type ValidEntry } from './entryDraft';
import type { EntryType } from './entryTypes';
import { parseNumber } from './numbers';
import type { ParsedItem } from './parser/schema';

type TankRef = { id: string; name: string };

export type AnalysisFieldId =
  | 'freeSo2'
  | 'totalSo2'
  | 'temperature'
  | 'ph'
  | 'ta'
  | 'va'
  | 'alcohol'
  | 'brix'
  | 'residualSugar'
  | 'density'
  | 'volume';

export type AnalysisField = {
  id: AnalysisFieldId;
  /** Shown on the form. */
  label: string;
  /** Saved as the item name; the same names the note parser uses, so spoken and typed values match. */
  name: string;
  /** The unit, or the choices when the user picks one (the first is the default). */
  units: readonly string[];
  min: number;
  max: number;
  placeholder: string;
};

export const ANALYSIS_FIELDS: readonly AnalysisField[] = [
  { id: 'freeSo2', label: 'Free SO2', name: 'Free SO2', units: ['mg/L'], min: 0, max: 500, placeholder: '28' },
  { id: 'totalSo2', label: 'Total SO2', name: 'Total SO2', units: ['mg/L'], min: 0, max: 1000, placeholder: '85' },
  { id: 'temperature', label: 'Temperature', name: 'Temperature', units: ['°C'], min: -20, max: 100, placeholder: '22' },
  { id: 'ph', label: 'pH', name: 'pH', units: [], min: 0, max: 14, placeholder: '3.45' },
  { id: 'ta', label: 'Titratable acidity', name: 'TA', units: ['g/L'], min: 0, max: 50, placeholder: '6.5' },
  { id: 'va', label: 'Volatile acidity', name: 'VA', units: ['g/L'], min: 0, max: 10, placeholder: '0.4' },
  { id: 'alcohol', label: 'Alcohol', name: 'Alcohol', units: ['%'], min: 0, max: 100, placeholder: '13' },
  { id: 'brix', label: 'Brix', name: 'Brix', units: ['°Bx'], min: -10, max: 60, placeholder: '24' },
  { id: 'residualSugar', label: 'Residual sugar', name: 'Residual sugar', units: ['g/L'], min: 0, max: 500, placeholder: '2' },
  { id: 'density', label: 'Density', name: 'Density', units: [], min: 0, max: 2000, placeholder: '0.995' },
  { id: 'volume', label: 'Volume', name: 'Volume', units: ['L', 'hL'], min: 0, max: 10_000_000, placeholder: '5000' },
];

export type AnalysisForm = {
  tankId: string | null;
  /** Raw text from each field; empty fields are skipped. */
  values: Partial<Record<AnalysisFieldId, string>>;
  /** Chosen unit for fields with a choice (volume). */
  units: Partial<Record<AnalysisFieldId, string>>;
  /** Fields added by the user: name, value, unit typed in. */
  extras: DraftItem[];
  note: string;
  /**
   * Editing a spoken entry keeps what was said as raw_text. Null: raw_text
   * follows the note (new analyses, and analyses typed in this form).
   */
  rawText: string | null;
};

export type AnalysisErrors = {
  tank?: string;
  fields?: Partial<Record<AnalysisFieldId, string>>;
  /** Keyed by DraftItem.key. */
  extras?: Record<string, string>;
  note?: string;
  form?: string;
};

const MAX_NAME = 100;
const MAX_VALUE = 200;
const MAX_UNIT = 30;
const MAX_NOTE = 5000;

export function emptyAnalysisForm(tankId: string | null): AnalysisForm {
  return { tankId, values: {}, units: {}, extras: [], note: '', rawText: null };
}

/** Lab analyses and temperature readings are edited in this form; other entries in the review form. */
export function editsAsAnalysis(type: EntryType): boolean {
  return type === 'lab_analysis' || type === 'temperature';
}

function fitsField(field: AnalysisField, item: ParsedItem): boolean {
  if (typeof item.value !== 'number') return false;
  return item.unit === null ? field.units.length === 0 : field.units.includes(item.unit);
}

/**
 * Opens a saved entry in the form. Each value goes into its field when the
 * name and unit fit; anything else (another unit, a second reading, a custom
 * value) becomes an added field, so saving without changes loses nothing.
 */
export function analysisFormFromSaved(saved: {
  tankId: string;
  rawText: string;
  parsed: { items: readonly ParsedItem[]; note: string | null };
}): AnalysisForm {
  const form = emptyAnalysisForm(saved.tankId);
  for (const item of saved.parsed.items) {
    const field = ANALYSIS_FIELDS.find((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase());
    if (field && form.values[field.id] === undefined && fitsField(field, item)) {
      form.values[field.id] = String(item.value);
      if (field.units.length > 1 && item.unit !== null) form.units[field.id] = item.unit;
    } else {
      form.extras.push(
        newDraftItem({ name: item.name, value: String(item.value), unit: item.unit ?? '' }),
      );
    }
  }
  const note = saved.parsed.note ?? '';
  form.note = note;
  // A typed analysis has its note as raw_text; anything else was spoken and is kept as it was.
  form.rawText = saved.rawText.trim() === note.trim() ? null : saved.rawText;
  return form;
}

export function unitFor(field: AnalysisField, form: AnalysisForm): string | null {
  const chosen = form.units[field.id];
  if (chosen !== undefined && field.units.includes(chosen)) return chosen;
  return field.units[0] ?? null;
}

/** "13%", "6,5 g/l" and "22 °C" are fine: a trailing unit is dropped before reading the number. */
function readNumber(text: string, units: readonly string[]): number | null {
  let cleaned = text.trim();
  for (const unit of [...units, '%', '°c', '°']) {
    if (cleaned.toLowerCase().endsWith(unit.toLowerCase())) {
      cleaned = cleaned.slice(0, -unit.length).trim();
      break;
    }
  }
  return parseNumber(cleaned);
}

function formatLimit(value: number): string {
  return value.toLocaleString('en-US');
}

export function validateAnalysisForm(
  form: AnalysisForm,
  tanks: readonly TankRef[],
): { ok: true; entry: ValidEntry } | { ok: false; errors: AnalysisErrors } {
  const errors: AnalysisErrors = {};

  const tank = tanks.find((candidate) => candidate.id === form.tankId);
  if (!tank) errors.tank = 'Choose the tank this analysis belongs to.';

  const items: ParsedItem[] = [];
  const fieldErrors: Partial<Record<AnalysisFieldId, string>> = {};
  for (const field of ANALYSIS_FIELDS) {
    const text = form.values[field.id] ?? '';
    if (text.trim() === '') continue;
    const value = readNumber(text, field.units);
    if (value === null || Number.isNaN(value)) {
      fieldErrors[field.id] = 'Type a number, like ' + field.placeholder + '.';
    } else if (value < field.min || value > field.max) {
      fieldErrors[field.id] = `Should be between ${formatLimit(field.min)} and ${formatLimit(field.max)}.`;
    } else {
      items.push({ name: field.name, value, unit: unitFor(field, form) });
    }
  }
  if (Object.keys(fieldErrors).length > 0) errors.fields = fieldErrors;

  const extraErrors: Record<string, string> = {};
  for (const row of form.extras) {
    const name = row.name.trim();
    const valueText = row.value.trim();
    const unit = row.unit.trim();
    if (name === '' && valueText === '' && unit === '') continue; // empty row: ignore

    if (name === '' || valueText === '') {
      extraErrors[row.key] = 'Fill in both name and value, or remove this field.';
    } else if (name.length > MAX_NAME || valueText.length > MAX_VALUE || unit.length > MAX_UNIT) {
      extraErrors[row.key] = 'This field is too long.';
    } else {
      // Numbers ("0,8") are saved as numbers so they can be compared later; anything else stays text.
      const number = parseNumber(valueText);
      const value = number === null || Number.isNaN(number) ? valueText : number;
      items.push({ name, value, unit: unit === '' ? null : unit });
    }
  }
  if (Object.keys(extraErrors).length > 0) errors.extras = extraErrors;

  const note = form.note.trim();
  if (note.length > MAX_NOTE) errors.note = `Keep the note under ${MAX_NOTE} characters.`;

  if (items.length === 0 && !errors.fields && !errors.extras) {
    errors.form = 'Fill in at least one value.';
  }

  if (!tank || Object.keys(errors).length > 0) return { ok: false, errors };

  // A temperature reading on its own is filed as Temperature; anything else as a lab analysis.
  const type: EntryType =
    items.length === 1 && items[0]?.name === 'Temperature' ? 'temperature' : 'lab_analysis';

  return {
    ok: true,
    entry: {
      tankId: tank.id,
      type,
      // Nothing was spoken: raw_text is just the typed note (unless editing a spoken entry).
      rawText: form.rawText ?? note,
      parsed: { tank_name: tank.name, type, items, note: note === '' ? null : note },
    },
  };
}
