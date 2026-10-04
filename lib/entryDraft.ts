// Pure logic for the review screen: parse result -> editable draft -> validated entry.
import type { EntryType } from './entryTypes';
import { parseNumber } from './numbers';
import type { ParsedEntry, ParsedItem, ParseResult } from './parser/schema';
import { matchTank } from './tankMatch';

type TankRef = { id: string; name: string };

/** One editable value row. All fields are raw text from inputs. */
export type DraftItem = { key: string; name: string; value: string; unit: string };

export type EntryDraft = {
  tankId: string | null;
  type: EntryType;
  items: DraftItem[];
  note: string;
  /** What was typed (or, later, transcribed). Saved as entries.raw_text. */
  rawText: string;
  /** A tank name the parser heard that matches none of the user's tanks. */
  unmatchedTankName: string | null;
};

export type DraftErrors = {
  tank?: string;
  /** Keyed by DraftItem.key. */
  items?: Record<string, string>;
  note?: string;
  form?: string;
};

export type ValidEntry = {
  tankId: string;
  type: EntryType;
  rawText: string;
  parsed: ParsedEntry;
};

const MAX_ITEM_NAME = 100;
const MAX_ITEM_VALUE = 200;
const MAX_UNIT = 30;
const MAX_NOTE = 5000;

let keyCounter = 0;

export function newDraftItem(fields?: Partial<Omit<DraftItem, 'key'>>): DraftItem {
  keyCounter += 1;
  return { key: `item-${keyCounter}`, name: '', value: '', unit: '', ...fields };
}

function itemToDraft(item: ParsedItem): DraftItem {
  return newDraftItem({ name: item.name, value: String(item.value), unit: item.unit ?? '' });
}

/**
 * Builds the review draft. The tank the parser heard wins; otherwise the
 * tank the user started from (`fallbackTankId`) is preselected.
 */
export function draftFromParse(
  result: ParseResult,
  tanks: readonly TankRef[],
  fallbackTankId: string | null,
): EntryDraft {
  const matched = matchTank(result.tank_name, tanks);
  return {
    tankId: matched?.id ?? fallbackTankId,
    type: result.type,
    items: result.items.map(itemToDraft),
    note: result.note ?? '',
    rawText: result.transcript,
    unmatchedTankName: result.tank_name !== null && matched === null ? result.tank_name : null,
  };
}

/** For "fill in yourself" when parsing failed: the text becomes the note. */
export function manualDraft(rawText: string, fallbackTankId: string | null): EntryDraft {
  return {
    tankId: fallbackTankId,
    type: 'note',
    items: [],
    note: rawText.trim(),
    rawText: rawText.trim(),
    unmatchedTankName: null,
  };
}

export function validateDraft(
  draft: EntryDraft,
  tanks: readonly TankRef[],
): { ok: true; entry: ValidEntry } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};

  const tank = tanks.find((candidate) => candidate.id === draft.tankId);
  if (!tank) errors.tank = 'Choose the tank this entry belongs to.';

  const items: ParsedItem[] = [];
  const itemErrors: Record<string, string> = {};
  for (const row of draft.items) {
    const name = row.name.trim();
    const valueText = row.value.trim();
    const unit = row.unit.trim();
    if (name === '' && valueText === '' && unit === '') continue; // empty row: ignore

    if (name === '' || valueText === '') {
      itemErrors[row.key] = 'Fill in both name and value, or remove this row.';
    } else if (name.length > MAX_ITEM_NAME || valueText.length > MAX_ITEM_VALUE || unit.length > MAX_UNIT) {
      itemErrors[row.key] = 'This row is too long.';
    } else {
      const number = parseNumber(valueText);
      const value = number === null || Number.isNaN(number) ? valueText : number;
      items.push({ name, value, unit: unit === '' ? null : unit });
    }
  }
  if (Object.keys(itemErrors).length > 0) errors.items = itemErrors;

  const note = draft.note.trim();
  if (note.length > MAX_NOTE) errors.note = `Keep the note under ${MAX_NOTE} characters.`;

  if (items.length === 0 && note === '' && !errors.items) {
    errors.form = 'Add at least one value or a note.';
  }

  if (!tank || Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    entry: {
      tankId: tank.id,
      type: draft.type,
      rawText: draft.rawText.trim() || note,
      parsed: { tank_name: tank.name, type: draft.type, items, note: note === '' ? null : note },
    },
  };
}
