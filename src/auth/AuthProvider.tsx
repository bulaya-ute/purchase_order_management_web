import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe, login as loginRequest, logout as logoutRequest } from '../api/authApi';
import type { CurrentUser } from '../api/authApi';
import { ApiError } from '../api/apiError';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch (error) {
        // 401 just means "not logged in" — not an error condition to surface.
        if (!(error instanceof ApiError && error.status === 401)) {
          // eslint-disable-next-line no-console
          console.error('Failed to load current session', error);
        }
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await loginRequest(email, password);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
