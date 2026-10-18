// Moving wine from one vessel to another: the two journal entries (one in each
// vessel), and optionally the grape and vintage moving with it. Pure.
import type { ValidEntry } from './entryDraft';
import { strings } from './i18n';
import { parseNumber } from './numbers';
import type { TankInput, VesselKind } from './tanks';

type Vessel = {
  id: string;
  name: string;
  kind: VesselKind;
  volumeLiters: number;
  variety: string | null;
  vintage: number | null;
};

export type TransferFormValues = {
  destinationId: string | null;
  /** Liters moved; empty = not recorded. */
  volume: string;
  note: string;
};

export type TransferErrors = Partial<Record<'destination' | 'volume' | 'note', string>>;

const MAX_VOLUME = 999_999_999.9;
const MAX_NOTE = 5000;

export type TransferPlan = {
  /** The entry for the vessel the wine leaves ("Destination", "Volume"). */
  sourceEntry: ValidEntry;
  /** The entry for the vessel that receives it ("Source", "Volume"). */
  destinationEntry: ValidEntry;
  volumeLiters: number | null;
};

/** Checks the form and builds both entries. The note is saved on both. */
export function planTransfer(
  source: Vessel,
  vessels: readonly Vessel[],
  values: TransferFormValues,
): { ok: true; plan: TransferPlan; destination: Vessel } | { ok: false; errors: TransferErrors } {
  const m = strings().messages;
  const errors: TransferErrors = {};

  const destination = vessels.find((vessel) => vessel.id === values.destinationId && vessel.id !== source.id);
  if (!destination) errors.destination = m.transferChooseDestination;

  let volume: number | null = null;
  if (values.volume.trim() !== '') {
    const parsed = parseNumber(values.volume);
    // One decimal, like tank volumes.
    const rounded = parsed === null || Number.isNaN(parsed) ? null : Math.round(parsed * 10) / 10;
    if (rounded === null || rounded <= 0 || rounded > MAX_VOLUME) errors.volume = m.transferVolume;
    else volume = rounded;
  }

  const note = values.note.trim();
  if (note.length > MAX_NOTE) errors.note = m.noteTooLong(MAX_NOTE);

  if (!destination || Object.keys(errors).length > 0) return { ok: false, errors };

  const entry = (vessel: Vessel, otherName: string, otherItem: 'Destination' | 'Source'): ValidEntry => ({
    tankId: vessel.id,
    type: 'transfer',
    rawText: note,
    parsed: {
      tank_name: vessel.name,
      type: 'transfer',
      items: [
        { name: otherItem, value: otherName, unit: null },
        ...(volume === null ? [] : [{ name: 'Volume', value: volume, unit: 'L' }]),
      ],
      note: note === '' ? null : note,
    },
  });

  return {
    ok: true,
    destination,
    plan: {
      sourceEntry: entry(source, destination.name, 'Destination'),
      destinationEntry: entry(destination, source.name, 'Source'),
      volumeLiters: volume,
    },
  };
}

const asInput = (vessel: Vessel, variety: string | null, vintage: number | null): TankInput => ({
  name: vessel.name,
  kind: vessel.kind,
  volumeLiters: vessel.volumeLiters,
  variety,
  vintage,
});

/**
 * The grape and vintage move with the wine: the receiving vessel takes the
 * source's, and the source is left empty. Null when the source has neither.
 */
export function moveGrape(source: Vessel, destination: Vessel): { source: TankInput; destination: TankInput } | null {
  if (source.variety === null && source.vintage === null) return null;
  return {
    source: asInput(source, null, null),
    destination: asInput(destination, source.variety, source.vintage),
  };
}
