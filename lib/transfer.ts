// Moving wine from one vessel to another: the two journal entries (one in each
// vessel), how much wine each vessel holds afterwards, the receiving vessel
// optionally taking the grape and vintage, and optionally a new vessel created
// for the wine. Also: working out whether a transfer empties the source (so the
// app can offer to delete it or keep it empty). Pure.
import type { ValidEntry } from './entryDraft';
import type { EntryType } from './entryTypes';
import type { FermentLike } from './fermentCurves';
import { formatLiters } from './format';
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
  /** Capacity. */
  volumeLiters: number;
  /** Wine in it now; null = not recorded. */
  contentLiters: number | null;
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
  /** Only for `NEW_TANK`: the new vessel (its capacity; the wine in it is the liters moved). */
  newName?: string;
  newKind?: VesselKind;
  newVolume?: string;
};

export type TransferErrors = Partial<Record<'destination' | 'volume' | 'note' | 'newName' | 'newVolume', string>>;

const MAX_VOLUME = 999_999_999.9;
const MAX_NOTE = 5000;
/** Rounding slack when comparing liters (volumes have one decimal). */
const SLACK = 0.05;

const round1 = (liters: number) => Math.round(liters * 10) / 10;

export type TransferPlan = {
  /** The entry for the vessel the wine leaves ("Destination", "Volume"). */
  sourceEntry: ValidEntry;
  /**
   * The entry for the vessel that receives it ("Source", "Volume"). For a new
   * vessel its `tankId` is empty: set it to the id the new vessel gets.
   */
  destinationEntry: ValidEntry;
  volumeLiters: number | null;
  /** The vessel to create first, when the wine goes into a new one (with the moved wine in it). */
  newTank: TankInput | null;
};

/**
 * Wine in a vessel before something is poured in: the recorded amount, or 0 when
 * nothing is recorded and it looks empty (no grape, no vintage). Otherwise unknown.
 */
export function contentBefore(vessel: Vessel): number | null {
  if (vessel.contentLiters !== null) return vessel.contentLiters;
  return vessel.variety === null && vessel.vintage === null ? 0 : null;
}

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

  let volume: number | null = null;
  if (values.volume.trim() !== '') {
    const parsed = parseNumber(values.volume);
    // One decimal, like tank volumes.
    const rounded = parsed === null || Number.isNaN(parsed) ? null : round1(parsed);
    if (rounded === null || rounded <= 0 || rounded > MAX_VOLUME) errors.volume = m.transferVolume;
    else if (source.contentLiters !== null && rounded > source.contentLiters + SLACK) {
      errors.volume = m.transferMoreThanHas(source.name, formatLiters(source.contentLiters));
    } else volume = rounded;
  }

  let newTank: TankInput | null = null;
  let destination: { id: string; name: string } | undefined;
  if (values.destinationId === NEW_TANK) {
    // The same checks as the tank form (name, capacity), plus no duplicate name.
    const form = validateTankForm({
      name: values.newName ?? '',
      kind: values.newKind ?? 'tank',
      volume: values.newVolume ?? '',
      content: '',
      variety: '',
      vintage: '',
    });
    if (!form.ok) {
      if (form.errors.name) errors.newName = form.errors.name;
      if (form.errors.volume) errors.newVolume = form.errors.volume;
    } else {
      const duplicate = findDuplicateName(form.input.name, vessels, null);
      if (duplicate) errors.newName = m.duplicateTank(duplicate.name);
      else if (volume !== null && volume > form.input.volumeLiters + SLACK) errors.newVolume = m.transferNewTooSmall;
      else {
        newTank = {
          ...form.input,
          contentLiters: volume,
          variety: giveContents ? source.variety : null,
          vintage: giveContents ? source.vintage : null,
        };
        destination = { id: '', name: form.input.name };
      }
    }
  } else {
    const found = vessels.find((vessel) => vessel.id === values.destinationId && vessel.id !== source.id);
    if (!found) errors.destination = m.transferChooseDestination;
    else {
      destination = { id: found.id, name: found.name };
      const before = contentBefore(found);
      if (volume !== null && before !== null && before + volume > found.volumeLiters + SLACK) {
        errors.volume = m.transferDoesNotFit(found.name, formatLiters(Math.max(0, round1(found.volumeLiters - before))));
      }
    }
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

const asInput = (
  vessel: Vessel,
  contentLiters: number | null,
  variety: string | null,
  vintage: number | null,
): TankInput => ({
  name: vessel.name,
  kind: vessel.kind,
  volumeLiters: vessel.volumeLiters,
  contentLiters,
  variety,
  vintage,
});

const sameAs = (vessel: Vessel, input: TankInput): boolean =>
  input.contentLiters === vessel.contentLiters && input.variety === vessel.variety && input.vintage === vessel.vintage;

/**
 * The receiving (existing) vessel after the wine came in: it holds `moved` liters
 * more (when both amounts are known) and optionally takes the grape and vintage
 * of the wine. Null when nothing changes.
 */
export function receive(source: Vessel, destination: Vessel, moved: number | null, giveContents: boolean): TankInput | null {
  const before = contentBefore(destination);
  const content = moved !== null && before !== null ? round1(before + moved) : destination.contentLiters;
  const gives = giveContents && (source.variety !== null || source.vintage !== null);
  const next = asInput(
    destination,
    content,
    gives ? source.variety : destination.variety,
    gives ? source.vintage : destination.vintage,
  );
  return sameAs(destination, next) ? null : next;
}

/**
 * The source after `moved` liters left it. The same wine stays in it, so it keeps
 * its grape and vintage, unless it is now `empty`: then it holds nothing (0 L, no
 * grape, no vintage). Null when nothing changes.
 */
export function sendOut(source: Vessel, moved: number | null, empty: boolean): TankInput | null {
  let next: TankInput;
  if (empty) next = asInput(source, 0, null, null);
  else if (moved !== null && source.contentLiters !== null) {
    next = asInput(source, Math.max(0, round1(source.contentLiters - moved)), source.variety, source.vintage);
  } else return null;
  return sameAs(source, next) ? null : next;
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
 * How many liters are left in the source after moving `moving` liters. With the
 * wine in it recorded, that is simply what it holds minus `moving`. Without it, the
 * capacity stands in for what it held, minus the wine already moved out since it
 * was last filled: the last transfer into it, or the start of its latest ferment,
 * whichever is newer. Null when the liters of this transfer are not known.
 */
export function litersLeft(
  source: { volumeLiters: number; contentLiters: number | null },
  entries: readonly EntryLike[],
  ferments: readonly FermentLike[],
  moving: number | null,
  now: Date = new Date(),
): number | null {
  if (moving === null) return null;
  if (source.contentLiters !== null) return round1(source.contentLiters - moving);
  const starts: string[] = [
    ...entries.filter((entry) => entry.type === 'transfer' && hasItem(entry, 'Source')).map((entry) => entry.createdAt),
    ...ferments.filter((ferment) => new Date(ferment.startedAt) <= now).map((ferment) => ferment.startedAt),
  ].map((iso) => new Date(iso).toISOString());
  const since = starts.sort().at(-1) ?? null;
  const out = entries
    .filter((entry) => entry.type === 'transfer' && hasItem(entry, 'Destination') && (since === null || entry.createdAt >= since))
    .reduce((sum, entry) => sum + litersOf(entry), 0);
  return round1(source.volumeLiters - out - moving);
}

/** The vessel is empty (to within a liter or so). */
export const isEmptyLeft = (left: number | null): boolean => left !== null && left <= 1;
