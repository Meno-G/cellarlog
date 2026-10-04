import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSession, onAuthChange, type Session } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }
  | { status: 'error'; message: string };

const SessionContext = createContext<SessionState | null>(null);

function fromSession(session: Session | null): SessionState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthChange((_event, session) => {
        if (active) setState(fromSession(session));
      });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) });
      return;
    }

    getSession()
      .then((session) => {
        if (active) setState(fromSession(session));
      })
      .catch((error: unknown) => {
        // A stored session that can't be restored just means signing in again.
        if (active) setState({ status: 'signedOut' });
        console.warn('Session restore failed:', errorMessage(error));
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
