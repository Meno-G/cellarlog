// Moving wine from one vessel to another: the two journal entries (one in each
// vessel), the receiving vessel optionally taking the grape and vintage, and
// optionally a new vessel created for the wine. Also: working out whether a
// transfer empties the source (so the app can offer to clear its data). Pure.
import type { ValidEntry } from './entryDraft';
import type { EntryType } from './entryTypes';
import type { FermentLike } from './fermentCurves';
import type { ParsedItem } from './parser/schema';
import { strings } from './i18n';
import { parseNumber } from './numbers';
import { validateTankForm } from './tankForm';
import { findDuplicateName } from './tankOverlay';
import type { TankInput } from './tanks';
import type { VesselKind } from './vesselKinds';

type Vessel = {
  id: string;
  name: string;
  kind: VesselKind;
  volumeLiters: number;
  variety: string | null;
  vintage: number | null;
};

/** The "destination" value that means "a vessel that doesn't exist yet". */
export const NEW_TANK = 'new';

export type TransferFormValues = {
  /** A vessel's id, `NEW_TANK`, or null (nothing chosen yet). */
  destinationId: string | null;
  /** Liters moved; empty = not recorded. */
  volume: string;
  note: string;
  /** Only for `NEW_TANK`: the new vessel. */
  newName?: string;
  newKind?: VesselKind;
  newVolume?: string;
};

export type TransferErrors = Partial<Record<'destination' | 'volume' | 'note' | 'newName' | 'newVolume', string>>;

const MAX_VOLUME = 999_999_999.9;
const MAX_NOTE = 5000;

export type TransferPlan = {
  /** The entry for the vessel the wine leaves ("Destination", "Volume"). */
  sourceEntry: ValidEntry;
  /**
   * The entry for the vessel that receives it ("Source", "Volume"). For a new
   * vessel its `tankId` is empty: set it to the id the new vessel gets.
   */
  destinationEntry: ValidEntry;
  volumeLiters: number | null;
  /** The vessel to create first, when the wine goes into a new one. */
  newTank: TankInput | null;
};

/** Checks the form and builds both entries (and the new vessel, if any). The note is saved on both. */
export function planTransfer(
  source: Vessel,
  vessels: readonly Vessel[],
  values: TransferFormValues,
  /** The receiving vessel gets the same grape and vintage (a new vessel is created with them). */
  giveContents = false,
):
  | { ok: true; plan: TransferPlan; destination: { id: string; name: string } }
  | { ok: false; errors: TransferErrors } {
  const m = strings().messages;
  const errors: TransferErrors = {};

  let newTank: TankInput | null = null;
  let destination: { id: string; name: string } | undefined;
  if (values.destinationId === NEW_TANK) {
    // The same checks as the tank form (name, volume), plus no duplicate name.
    const form = validateTankForm({
      name: values.newName ?? '',
      kind: values.newKind ?? 'tank',
      volume: values.newVolume ?? '',
      variety: '',
      vintage: '',
    });
    if (!form.ok) {
      if (form.errors.name) errors.newName = form.errors.name;
      if (form.errors.volume) errors.newVolume = form.errors.volume;
    } else {
      const duplicate = findDuplicateName(form.input.name, vessels, null);
      if (duplicate) errors.newName = m.duplicateTank(duplicate.name);
      else {
        newTank = {
          ...form.input,
          variety: giveContents ? source.variety : null,
          vintage: giveContents ? source.vintage : null,
        };
        destination = { id: '', name: form.input.name };
      }
    }
  } else {
    const found = vessels.find((vessel) => vessel.id === values.destinationId && vessel.id !== source.id);
    if (!found) errors.destination = m.transferChooseDestination;
    else destination = { id: found.id, name: found.name };
  }

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

  const entry = (tankId: string, tankName: string, otherName: string, otherItem: 'Destination' | 'Source'): ValidEntry => ({
    tankId,
    type: 'transfer',
    rawText: note,
    parsed: {
      tank_name: tankName,
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
      sourceEntry: entry(source.id, source.name, destination.name, 'Destination'),
      destinationEntry: entry(destination.id, destination.name, source.name, 'Source'),
      volumeLiters: volume,
      newTank,
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
 * The receiving (existing) vessel takes the grape and vintage of the wine that
 * came in. The source keeps its own: if wine is left in it, it is the same wine.
 * Null when the source has neither.
 */
export function giveGrape(source: Vessel, destination: Vessel): TankInput | null {
  if (source.variety === null && source.vintage === null) return null;
  return asInput(destination, source.variety, source.vintage);
}

/** The source emptied of grape and vintage (when the transfer leaves it empty). Null if it had none. */
export function emptied(source: Vessel): TankInput | null {
  return source.variety === null && source.vintage === null ? null : asInput(source, null, null);
}

type EntryLike = {
  type: EntryType;
  createdAt: string;
  parsed: { items: readonly ParsedItem[] };
};

const hasItem = (entry: EntryLike, name: string) => entry.parsed.items.some((item) => item.name === name);

/** Liters of a transfer entry's "Volume" item (L or hL); 0 when it has none. */
function litersOf(entry: EntryLike): number {
  const item = entry.parsed.items.find((candidate) => candidate.name === 'Volume');
  if (!item || typeof item.value !== 'number') return 0;
  return item.unit === 'hL' ? item.value * 100 : item.value;
}

/**
 * How many liters are left in the source after moving `moving` liters, counting
 * the wine already moved out since it was last filled: the last transfer into it,
 * or the start of its latest ferment, whichever is newer. Null when the liters of
 * this transfer are not known. This assumes the vessel's volume is what it held.
 */
export function litersLeft(
  source: { volumeLiters: number },
  entries: readonly EntryLike[],
  ferments: readonly FermentLike[],
  moving: number | null,
  now: Date = new Date(),
): number | null {
  if (moving === null) return null;
  const starts: string[] = [
    ...entries.filter((entry) => entry.type === 'transfer' && hasItem(entry, 'Source')).map((entry) => entry.createdAt),
    ...ferments.filter((ferment) => new Date(ferment.startedAt) <= now).map((ferment) => ferment.startedAt),
  ].map((iso) => new Date(iso).toISOString());
  const since = starts.sort().at(-1) ?? null;
  const out = entries
    .filter((entry) => entry.type === 'transfer' && hasItem(entry, 'Destination') && (since === null || entry.createdAt >= since))
    .reduce((sum, entry) => sum + litersOf(entry), 0);
  return Math.round((source.volumeLiters - out - moving) * 10) / 10;
}

/** The vessel is empty (to within a liter or so). */
export const isEmptyLeft = (left: number | null): boolean => left !== null && left <= 1;
