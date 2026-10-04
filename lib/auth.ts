import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';

import { AppError, NETWORK_MESSAGE, isNetworkFailure, toAppError } from './errors';
import { getSupabase } from './supabase';

export type { Session };

const MIN_PASSWORD_LENGTH = 6;

function validateCredentials(email: string, password: string): void {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError('validation', 'Enter a valid email address.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      'validation',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

function fromAuthError(error: AuthError): AppError {
  if (isAuthRetryableFetchError(error) || isNetworkFailure(error)) {
    return new AppError('network', NETWORK_MESSAGE, { cause: error });
  }
  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return new AppError('auth', 'Wrong email or password.', { cause: error });
      case 'email_not_confirmed':
        return new AppError('auth', 'Confirm your email first: open the link we sent you.', {
          cause: error,
        });
      case 'user_already_exists':
      case 'email_exists':
        return new AppError('auth', 'An account with this email already exists. Sign in instead.', {
          cause: error,
        });
      case 'weak_password':
        return new AppError('validation', 'That password is too weak. Try a longer one.', {
          cause: error,
        });
      case 'email_address_invalid':
        return new AppError('validation', 'Enter a valid email address.', { cause: error });
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return new AppError('auth', 'Too many attempts. Wait a minute and try again.', {
          cause: error,
        });
      case 'signup_disabled':
      case 'email_provider_disabled':
        return new AppError('auth', 'Sign-up with email is turned off for this project.', {
          cause: error,
        });
    }
  }
  return new AppError('server', 'Could not reach the sign-in service. Please try again.', {
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
    throw toAppError(error, 'Could not sign in. Please try again.');
  }
}

export type SignUpResult = { needsEmailConfirmation: boolean };

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const cleanEmail = email.trim().toLowerCase();
  validateCredentials(cleanEmail, password);
  try {
    const { data, error } = await getSupabase().auth.signUp({ email: cleanEmail, password });
    if (error) throw fromAuthError(error);
    // With "Confirm email" on, Supabase returns a user but no session.
    return { needsEmailConfirmation: data.session === null };
  } catch (error) {
    throw toAppError(error, 'Could not create the account. Please try again.');
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw fromAuthError(error);
  } catch (error) {
    throw toAppError(error, 'Could not sign out. Please try again.');
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw fromAuthError(error);
    return data.session;
  } catch (error) {
    throw toAppError(error, 'Could not restore your session.');
  }
}

/** Returns an unsubscribe function. */
export function onAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
