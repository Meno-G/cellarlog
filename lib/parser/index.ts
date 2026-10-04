import NetInfo from '@react-native-community/netinfo';

import { getEnv } from '../env';
import { AppError, NETWORK_MESSAGE, toAppError } from '../errors';
import { mockAudioTranscript, mockParse } from './mock';
import { parseResultSchema, type ParseResult } from './schema';

export type { ParsedEntry, ParsedItem, ParseResult } from './schema';

export type ParseInput =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; uri: string; mimeType: string; durationMs: number };

export type ParseContext = {
  /** The user's tank names, sent along so the parser can match "tank 12". */
  tankNames: readonly string[];
  /** The tank the user started from, if any. */
  defaultTankName: string | null;
};

const MAX_TEXT = 5000;

/** True when notes are parsed by the built-in mock instead of n8n. */
export function isMockParser(): boolean {
  return getEnv().parserMode === 'mock';
}
const MIN_AUDIO_MS = 700;

function validateInput(input: ParseInput): ParseInput {
  if (input.kind === 'text') {
    const text = input.text.trim();
    if (text === '') throw new AppError('validation', 'Type a note first.');
    if (text.length > MAX_TEXT) {
      throw new AppError('validation', `Keep the note under ${MAX_TEXT} characters.`);
    }
    return { kind: 'text', text };
  }
  if (input.uri === '') throw new AppError('validation', 'The recording is missing. Record again.');
  if (input.durationMs < MIN_AUDIO_MS) {
    throw new AppError('validation', 'That recording was too short. Record again.');
  }
  return input;
}

async function runMock(input: ParseInput, context: ParseContext): Promise<unknown> {
  if (input.kind === 'text') return mockParse(input.text, { tankNames: context.tankNames });

  // A real recording would be uploaded, so the mock fails offline like n8n would.
  const network = await NetInfo.fetch();
  if (network.isConnected === false || network.isInternetReachable === false) {
    throw new AppError('network', NETWORK_MESSAGE);
  }
  const tankName = context.defaultTankName ?? context.tankNames[0] ?? 'Tank 1';
  return mockParse(mockAudioTranscript(tankName, input.durationMs), {
    tankNames: context.tankNames,
  });
}

/**
 * Turns a typed or spoken note into a structured entry for the user to review.
 * Uses the mock parser or the n8n webhook depending on EXPO_PUBLIC_PARSER_MODE.
 * Throws AppError (network, server, invalid_response, validation, config).
 */
export async function parseNote(input: ParseInput, context: ParseContext): Promise<ParseResult> {
  const valid = validateInput(input);
  const { parserMode } = getEnv();

  let raw: unknown;
  try {
    if (parserMode === 'mock') {
      raw = await runMock(valid, context);
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
