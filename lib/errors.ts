import { strings } from './i18n';

export type AppErrorKind =
  | 'network'
  | 'permission'
  | 'server'
  | 'invalid_response'
  | 'auth'
  | 'validation'
  | 'config'
  | 'not_found';

/**
 * The only error type that leaves lib/. `message` is written for the person
 * holding the phone, so screens can show it as-is. `field` names the form
 * field the error belongs to, when there is one.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly field: string | undefined;

  constructor(
    kind: AppErrorKind,
    message: string,
    options?: { cause?: unknown; field?: string },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.field = options?.field;
  }
}

/** In the current language. */
export function networkMessage(): string {
  return strings().messages.network;
}

/** React Native's fetch rejects with a TypeError like "Network request failed". */
export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /network request failed|failed to fetch|network ?error|timed? ?out|abort/i.test(error.message);
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  if (isNetworkFailure(error)) return new AppError('network', networkMessage(), { cause: error });
  return new AppError('server', fallbackMessage, { cause: error });
}

/** For catch blocks in screens: always yields something showable. */
export function errorMessage(error: unknown): string {
  return toAppError(error, strings().messages.somethingWrong).message;
}

/** Shape of the `error` supabase-js returns from database calls. */
type DbError = { code: string; message: string };

/**
 * Maps a database (PostgREST) error to an AppError. supabase-js does not throw
 * on network failures; it returns them as an error whose message mentions the fetch failure.
 */
export function fromDbError(error: DbError, fallbackMessage: string): AppError {
  if (isNetworkFailure(new Error(error.message))) {
    return new AppError('network', networkMessage(), { cause: error });
  }
  switch (error.code) {
    case '22P02': // invalid input syntax, e.g. a malformed uuid in the URL
    case 'PGRST116': // .single() matched no rows
      return new AppError('not_found', strings().messages.notFound, { cause: error });
    case '42501': // row-level security
      return new AppError('permission', strings().messages.noAccess, { cause: error });
    case 'PGRST301':
    case 'PGRST303': // JWT expired / invalid
      return new AppError('auth', strings().messages.sessionExpired, {
        cause: error,
      });
    case '23514': // check constraint
      return new AppError('validation', strings().messages.outOfRange, {
        cause: error,
      });
  }
  return new AppError('server', fallbackMessage, { cause: error });
}
