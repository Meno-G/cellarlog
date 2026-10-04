import { AppError } from '../errors';
import { parseWithRules } from './rules';
import { parseResultSchema, type ParseResult } from './schema';

export type { ParsedEntry, ParsedItem, ParseResult } from './schema';

export type ParseContext = {
  /** The user's tank names, so "tank twelve" resolves to "Tank 12". */
  tankNames: readonly string[];
};

const MAX_TEXT = 5000;

/**
 * Turns a typed or spoken (already transcribed) note into a structured entry
 * for the user to review. Runs on the phone: instant, and works offline.
 * Throws AppError('validation') for empty or too-long notes.
 */
export function parseNote(text: string, context: ParseContext): ParseResult {
  const note = text.trim();
  if (note === '') throw new AppError('validation', 'Say or type a note first.');
  if (note.length > MAX_TEXT) {
    throw new AppError('validation', `Keep the note under ${MAX_TEXT} characters.`);
  }

  // The rules always produce this shape; validating keeps the contract honest.
  const parsed = parseResultSchema.safeParse(parseWithRules(note, context.tankNames));
  if (!parsed.success) {
    throw new AppError('invalid_response', "Couldn't read that note. Fill in the entry yourself.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}
