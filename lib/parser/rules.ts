// Rule-based note parser. Runs entirely on the phone (no network, no AI):
// the note is normalised first (./normalize.ts: "twenty grams per hectoliter" -> "20 g/hl"),
// then patterns pick out the tank, lab values, temperature, additions and transfers.
// It covers common phrasing; the review screen is where the user fixes the rest.

import type { EntryType } from '../entryTypes';
import { parseNumber } from '../numbers';
import { normalizeNote } from './normalize';
import type { ParsedItem, ParseResult } from './schema';

const NUM = String.raw`(-?\d+(?:[.,]\d+)?)`;
const SEP = String.raw`\s*(?:is|of|at|was|=|:)?\s*`;

const UNIT_NAMES: [RegExp, string][] = [
  [/^g\/?hl$/i, 'g/hL'],
  [/^mg\/?l$/i, 'mg/L'],
  [/^g\/?l$/i, 'g/L'],
  [/^ml\/?hl$/i, 'mL/hL'],
  [/^ml\/?l$/i, 'mL/L'],
  [/^kg$/i, 'kg'],
  [/^g$/i, 'g'],
  [/^ml$/i, 'mL'],
  [/^(?:l|liters?|litres?)$/i, 'L'],
  [/^hl$/i, 'hL'],
  [/^ppm$/i, 'ppm'],
];

function normalizeUnit(unit: string): string {
  return UNIT_NAMES.find(([pattern]) => pattern.test(unit))?.[1] ?? unit;
}

function toValue(text: string): number | string {
  const number = parseNumber(text);
  return number === null || Number.isNaN(number) ? text : number;
}

type Measure = { name: string; pattern: RegExp; unit: string | null };

// Lab values. The first capture group is the number; an optional second one is the unit.
const LAB_MEASURES: Measure[] = [
  { name: 'Free SO2', pattern: new RegExp(String.raw`\bfree\s*so2${SEP}${NUM}\s*(mg\/?l|ppm)?`, 'i'), unit: 'mg/L' },
  { name: 'Total SO2', pattern: new RegExp(String.raw`\btotal\s*so2${SEP}${NUM}\s*(mg\/?l|ppm)?`, 'i'), unit: 'mg/L' },
  { name: 'pH', pattern: new RegExp(String.raw`\bph${SEP}${NUM}`, 'i'), unit: null },
  { name: 'Brix', pattern: new RegExp(String.raw`\b(?:brix|bx)${SEP}${NUM}`, 'i'), unit: '°Bx' },
  { name: 'Brix', pattern: new RegExp(String.raw`${NUM}\s*°?\s*(?:brix|bx)\b`, 'i'), unit: '°Bx' },
  { name: 'TA', pattern: new RegExp(String.raw`\b(?:ta|total acid(?:ity)?|titratable acid(?:ity)?)${SEP}${NUM}\s*(g\/?l)?`, 'i'), unit: 'g/L' },
  { name: 'VA', pattern: new RegExp(String.raw`\b(?:va|volatile acid(?:ity)?)${SEP}${NUM}\s*(g\/?l)?`, 'i'), unit: 'g/L' },
  { name: 'Malic acid', pattern: new RegExp(String.raw`\bmalic(?: acid)?${SEP}${NUM}\s*(g\/?l)?`, 'i'), unit: 'g/L' },
  { name: 'Residual sugar', pattern: new RegExp(String.raw`\b(?:rs|residual sugar|sugar)${SEP}${NUM}\s*(g\/?l)?`, 'i'), unit: 'g/L' },
  { name: 'Alcohol', pattern: new RegExp(String.raw`\b(?:alcohol|abv|alc)${SEP}${NUM}\s*%?`, 'i'), unit: '%' },
  { name: 'Density', pattern: new RegExp(String.raw`\b(?:density|sg|specific gravity)${SEP}${NUM}`, 'i'), unit: null },
];

const TEMPERATURE_PATTERNS = [
  new RegExp(String.raw`\b(?:temp|temperature)${SEP}${NUM}\s*(?:°|degrees?|deg)?\s*([cf])?\b`, 'i'),
  new RegExp(String.raw`${NUM}\s*(?:°\s*|degrees?\s*|deg\s*)([cf])\b`, 'i'),
  new RegExp(String.raw`${NUM}\s*°`, 'i'),
];

const ADDITION_PATTERN = new RegExp(
  String.raw`${NUM}\s*(g\/?hl|mg\/?l|g\/?l|ml\/?hl|ml\/?l|kg|g|ml|ppm)\s+(?:of\s+)?` +
    String.raw`([\p{L}][\p{L}\p{N}-]*(?:\s+(?!and\b|then\b|temp\b|at\b|to\b|in\b)[\p{L}][\p{L}\p{N}-]*){0,2})`,
  'giu',
);

const TRANSFER_KEYWORDS = /\b(?:transfer(?:red)?|rack(?:ed)?|mov(?:e|ed))\b/i;
const TASTING_KEYWORDS = /\b(?:tast(?:e|ed|ing)|nose|palate|aroma|smells?|finish|mouthfeel|tannins? (?:are|is))\b/i;
const GENERIC_TANK = /\b(?:tank|tk|t)\s*#?\s*(\d+[a-z]?)\b/gi;

/** Replaces a matched span with spaces so later patterns don't match it twice. */
function blank(text: string, index: number, length: number): string {
  return text.slice(0, index) + ' '.repeat(length) + text.slice(index + length);
}

type Mention = { name: string; index: number; end: number };

function findTankMentions(text: string, tankNames: readonly string[]): Mention[] {
  const mentions: Mention[] = [];
  const lower = text.toLowerCase();
  // Known tank names first, longest first, so "Tank 12a" wins over "Tank 12".
  for (const name of [...tankNames].sort((a, b) => b.length - a.length)) {
    const needle = name.toLowerCase().trim();
    if (needle === '') continue;
    let from = 0;
    for (;;) {
      const index = lower.indexOf(needle, from);
      if (index < 0) break;
      const before = lower[index - 1];
      const after = lower[index + needle.length];
      const isWord = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
      if (!isWord(before) && !isWord(after)) {
        const overlaps = mentions.some((m) => index < m.end && index + needle.length > m.index);
        if (!overlaps) mentions.push({ name, index, end: index + needle.length });
      }
      from = index + needle.length;
    }
  }
  for (const match of text.matchAll(GENERIC_TANK)) {
    const index = match.index;
    const end = index + match[0].length;
    if (mentions.some((m) => index < m.end && end > m.index)) continue;
    mentions.push({ name: `Tank ${match[1] ?? ''}`.trim(), index, end });
  }
  return mentions.sort((a, b) => a.index - b.index);
}

function isDestination(text: string, mention: Mention): boolean {
  return /\b(?:to|into)\s*$/i.test(text.slice(Math.max(0, mention.index - 6), mention.index));
}

/**
 * Parses a typed or spoken note. `transcript` in the result is the note exactly
 * as given (saved as raw_text); everything else comes from the normalised text.
 */
export function parseWithRules(input: string, tankNames: readonly string[]): ParseResult {
  const original = input.trim();
  const transcript = normalizeNote(original);
  let rest = transcript;
  // Items remember where they were found, so they are listed in the order spoken.
  const found: { item: ParsedItem; index: number }[] = [];
  const add = (item: ParsedItem, index: number) => found.push({ item, index });

  // Tanks
  const mentions = findTankMentions(transcript, tankNames);
  const destination = mentions.find((m) => isDestination(transcript, m));
  const source = mentions.find((m) => m !== destination);
  for (const mention of mentions) rest = blank(rest, mention.index, mention.end - mention.index);

  // Lab values
  let labCount = 0;
  for (const measure of LAB_MEASURES) {
    const match = measure.pattern.exec(rest);
    if (!match?.[1]) continue;
    const unit = match[2] ? normalizeUnit(match[2]) : measure.unit;
    add({ name: measure.name, value: toValue(match[1]), unit }, match.index);
    rest = blank(rest, match.index, match[0].length);
    labCount++;
  }

  // Temperature
  let hasTemperature = false;
  for (const pattern of TEMPERATURE_PATTERNS) {
    const match = pattern.exec(rest);
    if (!match?.[1]) continue;
    const scale = (match[2] ?? 'c').toUpperCase();
    add({ name: 'Temperature', value: toValue(match[1]), unit: `°${scale}` }, match.index);
    rest = blank(rest, match.index, match[0].length);
    hasTemperature = true;
    break;
  }

  // Transfer
  const isTransfer = TRANSFER_KEYWORDS.test(transcript);
  if (isTransfer) {
    if (destination) add({ name: 'Destination', value: destination.name, unit: null }, destination.index);
    const volume = new RegExp(String.raw`${NUM}\s*(hl|l|liters?|litres?)\b`, 'i').exec(rest);
    if (volume?.[1] && volume[2]) {
      add({ name: 'Volume', value: toValue(volume[1]), unit: normalizeUnit(volume[2]) }, volume.index);
      rest = blank(rest, volume.index, volume[0].length);
    }
  }

  // Additions: "<amount> <unit> [of] <substance>"
  let additionCount = 0;
  if (!isTransfer) {
    for (const match of rest.matchAll(ADDITION_PATTERN)) {
      if (!match[1] || !match[2] || !match[3]) continue;
      add({ name: match[3].trim(), value: toValue(match[1]), unit: normalizeUnit(match[2]) }, match.index);
      additionCount++;
    }
  }

  const items = found.sort((a, b) => a.index - b.index).map((entry) => entry.item);

  let type: EntryType;
  if (isTransfer) type = 'transfer';
  else if (labCount > 0) type = 'lab_analysis';
  else if (additionCount > 0) type = 'addition';
  else if (hasTemperature) type = 'temperature';
  else if (TASTING_KEYWORDS.test(transcript)) type = 'tasting';
  else type = 'note';

  // Free text is kept for tastings and plain notes, minus the tank name.
  const note =
    type === 'tasting' || type === 'note'
      ? rest
          .replace(/\s+/g, ' ')
          .replace(/\s+([,.;:!?])/g, '$1')
          .replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '')
          .trim() || null
      : null;

  return { tank_name: source?.name ?? null, type, items, note, transcript: original };
}
