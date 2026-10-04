import { getEnv } from '../env';
import { AppError, toAppError } from '../errors';
import { mockParse } from './mock';
import { parseResultSchema, type ParseResult } from './schema';

export type { ParsedEntry, ParsedItem, ParseResult } from './schema';

export type ParseInput = { kind: 'text'; text: string };

export type ParseContext = {
  /** The user's tank names, sent along so the parser can match "tank 12". */
  tankNames: readonly string[];
};

const MAX_TEXT = 5000;

/**
 * Turns a note into a structured entry for the user to review.
 * Uses the mock parser or the n8n webhook depending on EXPO_PUBLIC_PARSER_MODE.
 * Throws AppError (network, server, invalid_response, validation, config).
 */
export async function parseNote(input: ParseInput, context: ParseContext): Promise<ParseResult> {
  const text = input.text.trim();
  if (text === '') throw new AppError('validation', 'Type a note first.');
  if (text.length > MAX_TEXT) {
    throw new AppError('validation', `Keep the note under ${MAX_TEXT} characters.`);
  }

  const { parserMode } = getEnv();
  let raw: unknown;
  try {
    if (parserMode === 'mock') {
      raw = await mockParse(text, { tankNames: context.tankNames });
    } else {
      throw new AppError(
        'config',
        'The n8n parser is connected in step 6. Set EXPO_PUBLIC_PARSER_MODE=mock for now.',
      );
    }
  } catch (error) {
    throw toAppError(error, 'Could not read the note. Please try again.');
  }

  const parsed = parseResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'invalid_response',
      "Couldn't understand the parser's answer. Try again or fill in the entry yourself.",
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
