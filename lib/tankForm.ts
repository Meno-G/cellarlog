// Pure form logic for the tank form (no network), so it can be unit-tested.
import type { Tank, TankInput } from './tanks';

/** Raw text from the form inputs. */
export type TankFormValues = {
  name: string;
  volume: string;
  variety: string;
  vintage: string;
};

export type TankFormErrors = Partial<Record<keyof TankFormValues, string>>;

export const TANK_FORM_FIELDS: readonly (keyof TankFormValues)[] = [
  'name',
  'volume',
  'variety',
  'vintage',
];

// Limits mirror the CHECK constraints in supabase/migrations.
const MAX_NAME = 100;
const MAX_VARIETY = 100;
const MAX_VOLUME = 999_999_999.9; // numeric(10, 1)
const MIN_VINTAGE = 1900;
const MAX_VINTAGE = 2100;

export const emptyTankForm: TankFormValues = { name: '', volume: '', variety: '', vintage: '' };

export function tankToForm(tank: Tank): TankFormValues {
  return {
    name: tank.name,
    volume: String(tank.volumeLiters),
    variety: tank.variety ?? '',
    vintage: tank.vintage === null ? '' : String(tank.vintage),
  };
}

/**
 * Parses what people type on a phone keypad: "5000", "5 000", "5,000",
 * "5,000.5" and "5000,5" (comma as decimal separator).
 * Returns null for empty input and NaN for anything that isn't a number.
 */
export function parseNumber(text: string): number | null {
  let cleaned = text.replace(/[\s']/g, '');
  if (cleaned === '') return null;
  if (cleaned.includes('.') || /^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    // "5,000.5" or "12,500": commas are thousands separators.
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // "5000,5": a comma is the decimal separator.
    cleaned = cleaned.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export function validateTankForm(
  values: TankFormValues,
): { ok: true; input: TankInput } | { ok: false; errors: TankFormErrors } {
  const errors: TankFormErrors = {};

  const name = values.name.trim();
  if (name === '') errors.name = 'Give the tank a name, e.g. "Tank 12".';
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters.`;

  const parsedVolume = parseNumber(values.volume);
  // Stored with one decimal, so 0.04 would become 0.
  const volume = parsedVolume === null ? null : Math.round(parsedVolume * 10) / 10;
  if (volume === null) errors.volume = 'Enter the volume in liters.';
  else if (Number.isNaN(volume)) errors.volume = 'Use numbers only, e.g. 5000.';
  else if (volume <= 0) errors.volume = 'Volume must be more than 0 L.';
  else if (volume > MAX_VOLUME) errors.volume = 'That volume is too large.';

  const variety = values.variety.trim();
  if (variety.length > MAX_VARIETY) {
    errors.variety = `Keep the variety under ${MAX_VARIETY} characters.`;
  }

  const vintageText = values.vintage.trim();
  let vintage: number | null = null;
  if (vintageText !== '') {
    vintage = /^\d{4}$/.test(vintageText) ? Number(vintageText) : Number.NaN;
    if (Number.isNaN(vintage) || vintage < MIN_VINTAGE || vintage > MAX_VINTAGE) {
      errors.vintage = `Enter a year between ${MIN_VINTAGE} and ${MAX_VINTAGE}, or leave it empty.`;
    }
  }

  if (Object.keys(errors).length > 0 || volume === null) return { ok: false, errors };

  return {
    ok: true,
    input: { name, volumeLiters: volume, variety: variety === '' ? null : variety, vintage },
  };
}
