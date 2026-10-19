// Pure form logic for the tank form (no network), so it can be unit-tested.
import { strings } from './i18n';
import { parseNumber } from './numbers';
import type { Tank, TankInput } from './tanks';
import type { VesselKind } from './vesselKinds';

/** Raw text from the form inputs. */
export type TankFormValues = {
  name: string;
  kind: VesselKind;
  volume: string;
  /** Wine in it now (liters); empty = not recorded. */
  content: string;
  variety: string;
  vintage: string;
};

export type TankFormErrors = Partial<Record<Exclude<keyof TankFormValues, 'kind'>, string>>;

export const TANK_FORM_FIELDS: readonly (keyof TankFormErrors)[] = [
  'name',
  'volume',
  'content',
  'variety',
  'vintage',
];

// Limits mirror the CHECK constraints in supabase/migrations.
const MAX_NAME = 100;
const MAX_VARIETY = 100;
const MAX_VOLUME = 999_999_999.9; // numeric(10, 1)
const MIN_VINTAGE = 1900;
const MAX_VINTAGE = 2100;

export const emptyTankForm: TankFormValues = { name: '', kind: 'tank', volume: '', content: '', variety: '', vintage: '' };

export function tankToForm(tank: Tank): TankFormValues {
  return {
    name: tank.name,
    kind: tank.kind,
    volume: String(tank.volumeLiters),
    content: tank.contentLiters === null ? '' : String(tank.contentLiters),
    variety: tank.variety ?? '',
    vintage: tank.vintage === null ? '' : String(tank.vintage),
  };
}

export function validateTankForm(
  values: TankFormValues,
): { ok: true; input: TankInput } | { ok: false; errors: TankFormErrors } {
  const errors: TankFormErrors = {};
  const m = strings().messages;

  const name = values.name.trim();
  if (name === '') errors.name = m.tankNameRequired;
  else if (name.length > MAX_NAME) errors.name = m.tankNameTooLong(MAX_NAME);

  const parsedVolume = parseNumber(values.volume);
  // Stored with one decimal, so 0.04 would become 0.
  const volume = parsedVolume === null ? null : Math.round(parsedVolume * 10) / 10;
  if (volume === null) errors.volume = m.volumeRequired;
  else if (Number.isNaN(volume)) errors.volume = m.volumeNumbersOnly;
  else if (volume <= 0) errors.volume = m.volumePositive;
  else if (volume > MAX_VOLUME) errors.volume = m.volumeTooLarge;

  // The wine in it is optional, and can't be more than fits.
  let content: number | null = null;
  if (values.content.trim() !== '') {
    const parsedContent = parseNumber(values.content);
    const rounded = parsedContent === null ? null : Math.round(parsedContent * 10) / 10;
    if (rounded === null || Number.isNaN(rounded) || rounded < 0) errors.content = m.volumeNumbersOnly;
    else if (rounded > MAX_VOLUME) errors.content = m.volumeTooLarge;
    else if (volume !== null && !Number.isNaN(volume) && rounded > volume) errors.content = m.contentTooLarge;
    else content = rounded;
  }

  const variety = values.variety.trim();
  if (variety.length > MAX_VARIETY) {
    errors.variety = m.varietyTooLong(MAX_VARIETY);
  }

  const vintageText = values.vintage.trim();
  let vintage: number | null = null;
  if (vintageText !== '') {
    vintage = /^\d{4}$/.test(vintageText) ? Number(vintageText) : Number.NaN;
    if (Number.isNaN(vintage) || vintage < MIN_VINTAGE || vintage > MAX_VINTAGE) {
      errors.vintage = m.vintageRange(MIN_VINTAGE, MAX_VINTAGE);
    }
  }

  if (Object.keys(errors).length > 0 || volume === null) return { ok: false, errors };

  return {
    ok: true,
    input: { name, kind: values.kind, volumeLiters: volume, contentLiters: content, variety: variety === '' ? null : variety, vintage },
  };
}
