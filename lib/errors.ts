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
 * holding the phone, so screens can show it as-is.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;

  constructor(kind: AppErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.kind = kind;
  }
}

export const NETWORK_MESSAGE = 'No internet connection. Check your signal and try again.';

/** React Native's fetch rejects with a TypeError like "Network request failed". */
export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /network request failed|failed to fetch|network ?error|timed? ?out/i.test(error.message);
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  if (isNetworkFailure(error)) return new AppError('network', NETWORK_MESSAGE, { cause: error });
  return new AppError('server', fallbackMessage, { cause: error });
}

/** For catch blocks in screens: always yields something showable. */
export function errorMessage(error: unknown): string {
  return toAppError(error, 'Something went wrong. Please try again.').message;
}
