// Turns a vessel's entries into a CSV for records, inspections or a spreadsheet.
// Pure: no network, no files (see ./shareFile.ts for how it is handed to the user).
//
// One row per measured value ("long" format), so any spreadsheet can filter and
// chart it. An entry without values (a tasting, a note, a decision) is one row.
import type { EntryType } from './entryTypes';
import { entriesInFerment, fermentDay, type FermentLike } from './fermentCurves';
import { dayString } from './fermentForm';
import type { ParsedItem } from './parser/schema';

export type ExportEntry = {
  type: EntryType;
  createdAt: string;
  rawText: string;
  parsed: { note: string | null; items: readonly ParsedItem[] };
};

/** Headers stay English whatever the app language, so files are comparable. */
export const CSV_HEADER = [
  'vessel',
  'vessel_type',
  'ferment',
  'ferment_day',
  'time_local',
  'time_utc',
  'entry_type',
  'name',
  'value',
  'unit',
  'note',
  'said',
] as const;

/**
 * One CSV cell. Quoted when needed; text that a spreadsheet would run as a
 * formula (starting with = + - @) gets a leading apostrophe instead.
 */
export function csvCell(text: string, isText = true): string {
  let cell = text;
  if (isText && /^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function localTime(iso: string): string {
  const date = new Date(iso);
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${dayString(date)} ${clock}`;
}

/** Which entries to export: the whole vessel, or just one ferment's (by date). */
export function entriesForScope<T extends { createdAt: string }>(
  entries: readonly T[],
  ferments: readonly FermentLike[],
  scope: 'all' | string,
  now: Date = new Date(),
): T[] {
  const ferment = scope === 'all' ? undefined : ferments.find((candidate) => candidate.id === scope);
  return ferment ? entriesInFerment(entries, ferment, now) : [...entries];
}

/**
 * The CSV text, oldest entry first. Rows end with CRLF. Prefix a byte order
 * mark when writing a file, so Excel reads the UTF-8 (Georgian) text correctly.
 */
export function entriesToCsv(input: {
  vessel: { name: string; kind: string };
  ferments: readonly FermentLike[];
  entries: readonly ExportEntry[];
}): string {
  const rows: string[][] = [[...CSV_HEADER]];
  const oldestFirst = [...input.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const entry of oldestFirst) {
    const at = new Date(entry.createdAt).getTime();
    // Ferments in one vessel never overlap, so at most one contains the entry.
    const ferment = input.ferments.find((candidate) => {
      const from = new Date(candidate.startedAt).getTime();
      const to = candidate.endedAt === null ? Infinity : new Date(candidate.endedAt).getTime();
      return at >= from && at <= to;
    });
    const note = entry.parsed.note ?? '';
    // What was said or typed, only when it adds something beyond the note.
    const said = entry.rawText.trim() !== '' && entry.rawText.trim() !== note.trim() ? entry.rawText : '';
    const base = [
      input.vessel.name,
      input.vessel.kind,
      ferment?.name ?? '',
      ferment ? String(fermentDay(ferment.startedAt, entry.createdAt)) : '',
      localTime(entry.createdAt),
      entry.createdAt,
      entry.type,
    ];
    const items = entry.parsed.items;
    if (items.length === 0) {
      rows.push([...base, '', '', '', note, said]);
    } else {
      items.forEach((item, index) => {
        // The note and the said-text go on the entry's first row only, not repeated.
        rows.push([...base, item.name, String(item.value), item.unit ?? '', index === 0 ? note : '', index === 0 ? said : '']);
      });
    }
  }

  // Values that are numbers are written bare (no formula guard); everything else is text.
  const numericColumns = new Set([3, 8]);
  return rows
    .map((row, rowIndex) =>
      row
        .map((cell, column) => {
          const isNumber = rowIndex > 0 && numericColumns.has(column) && cell !== '' && !Number.isNaN(Number(cell));
          return csvCell(cell, !isNumber);
        })
        .join(','),
    )
    .join('\r\n') + '\r\n';
}

/** "enolog-tank-12-saperavi-2026-2026-10-18.csv" (letters of any script are kept). */
export function csvFilename(vesselName: string, fermentName: string | null, now: Date = new Date()): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  const parts = ['enolog', slug(vesselName) || 'vessel', fermentName ? slug(fermentName) : '', dayString(now)];
  return `${parts.filter((part) => part !== '').join('-')}.csv`;
}
