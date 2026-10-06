import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSession, getStoredUser, onAuthChange, userFromSession, type SessionUser } from '@/lib/auth';
import { clearCache } from '@/lib/cache';
import { AppError, errorMessage } from '@/lib/errors';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | {
      status: 'signedIn';
      user: SessionUser;
      /** Restored from the phone without the server (offline start); refreshed once online. */
      offline: boolean;
    }
  | { status: 'error'; message: string };

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let currentUserId: string | null = null;

    const signedIn = (user: SessionUser, offline: boolean) => {
      currentUserId = user.id;
      setState({ status: 'signedIn', user, offline });
    };
    const signedOut = () => {
      // The saved copy of this cellar leaves with the user (queued entries stay,
      // and upload the next time this account signs in on this phone).
      if (currentUserId) clearCache(currentUserId);
      currentUserId = null;
      setState({ status: 'signedOut' });
    };

    try {
      unsubscribe = onAuthChange((event, session) => {
        if (!active) return;
        // The first state comes from getSession() below, which can tell
        // "signed out" apart from "offline with an expired token".
        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_OUT' || !session) signedOut();
        else signedIn(userFromSession(session), false);
      });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) });
      return;
    }

    getSession()
      .then((session) => {
        if (!active) return;
        if (session) signedIn(userFromSession(session), false);
        else setState({ status: 'signedOut' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        // Offline with an expired token: stay signed in with the saved login so
        // cached tanks and the outbox work in the cellar. supabase-js refreshes
        // the token (TOKEN_REFRESHED above) when the connection comes back.
        const stored = error instanceof AppError && error.kind === 'network' ? getStoredUser() : null;
        if (stored) signedIn(stored, true);
        else {
          setState({ status: 'signedOut' });
          console.warn('Session restore failed:', errorMessage(error));
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The signed-in user. Only for screens inside the signed-in (app) group. */
export function useUser(): SessionUser {
  const session = useSession();
  if (session.status !== 'signedIn') throw new Error('useUser used while signed out');
  return session.user;
}
