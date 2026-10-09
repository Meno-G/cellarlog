import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';

import { z } from 'zod';

import { AppError, fromDbError, isNetworkFailure, networkMessage, toAppError } from './errors';
import { strings } from './i18n';
import { clearOutbox } from './outbox';
import { readJson } from './storage';
import { getSupabase, sessionStorageKey } from './supabase';

export type { Session };

/** The signed-in person, as the app needs them. */
export type SessionUser = { id: string; email: string | null };

export function userFromSession(session: Session): SessionUser {
  return { id: session.user.id, email: session.user.email ?? null };
}

const storedSessionSchema = z.object({
  user: z.object({ id: z.string().min(1), email: z.string().optional() }),
});

/**
 * The user from the login saved on the phone, without asking the server.
 * Used when the app starts offline with an expired access token: supabase-js
 * then reports "no session" but keeps the login, and refreshes it once online.
 */
export function getStoredUser(): SessionUser | null {
  try {
    const stored = readJson(sessionStorageKey(), storedSessionSchema);
    return stored ? { id: stored.user.id, email: stored.user.email ?? null } : null;
  } catch {
    return null;
  }
}

const MIN_PASSWORD_LENGTH = 6;

function validateCredentials(email: string, password: string): void {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError('validation', strings().messages.invalidEmail);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError('validation', strings().messages.passwordTooShort(MIN_PASSWORD_LENGTH));
  }
}

function fromAuthError(error: AuthError): AppError {
  if (isAuthRetryableFetchError(error) || isNetworkFailure(error)) {
    return new AppError('network', networkMessage(), { cause: error });
  }
  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return new AppError('auth', strings().messages.wrongPassword, { cause: error });
      case 'email_not_confirmed':
        return new AppError('auth', strings().messages.confirmEmail, {
          cause: error,
        });
      case 'user_already_exists':
      case 'email_exists':
        return new AppError('auth', strings().messages.accountExists, {
          cause: error,
        });
      case 'weak_password':
        return new AppError('validation', strings().messages.weakPassword, {
          cause: error,
        });
      case 'email_address_invalid':
        return new AppError('validation', strings().messages.invalidEmail, { cause: error });
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return new AppError('auth', strings().messages.tooManyAttempts, {
          cause: error,
        });
      case 'signup_disabled':
      case 'email_provider_disabled':
        return new AppError('auth', strings().messages.signupDisabled, {
          cause: error,
        });
    }
  }
  return new AppError('server', strings().messages.authUnreachable, {
    cause: error,
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  validateCredentials(cleanEmail, password);
  try {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw fromAuthError(error);
  } catch (error) {
    throw toAppError(error, strings().messages.signInFailed);
  }
}

export type SignUpResult = { needsEmailConfirmation: boolean };

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const cleanEmail = email.trim().toLowerCase();
  validateCredentials(cleanEmail, password);
  try {
    const { data, error } = await getSupabase().auth.signUp({ email: cleanEmail, password });
    if (error) throw fromAuthError(error);
    // With "Confirm email" on, signing up with an existing email "succeeds" without
    // sending anything (to hide which emails exist); the only sign is a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      throw new AppError(
        'auth',
        strings().messages.accountExistsUsePassword,
      );
    }
    // With "Confirm email" on, a genuinely new user gets no session until they confirm.
    return { needsEmailConfirmation: data.session === null };
  } catch (error) {
    throw toAppError(error, strings().messages.signUpFailed);
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw fromAuthError(error);
  } catch (error) {
    throw toAppError(error, strings().messages.signOutFailed);
  }
}

/**
 * Deletes the signed-in user's account for good: the login, and with it (in the
 * database) all their tanks and entries. Needs a connection. Changes still
 * waiting on this phone are thrown away, then the user is signed out here.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const failed = strings().messages.deleteAccountFailed;
  try {
    const { error } = await getSupabase().rpc('delete_my_account');
    if (error) throw fromDbError(error, failed);
    clearOutbox(userId);
    // The login no longer exists on the server; only this phone's copy is left to drop.
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch (error) {
    throw toAppError(error, failed);
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw fromAuthError(error);
    return data.session;
  } catch (error) {
    throw toAppError(error, strings().messages.sessionRestoreFailed);
  }
}

/** Returns an unsubscribe function. */
export function onAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
