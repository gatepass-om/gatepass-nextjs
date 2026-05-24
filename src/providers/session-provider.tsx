'use client';

import { loginRequest, fetchCurrentUserRequest } from '@/lib/api';
import type { User } from '@/lib/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const TOKEN_KEY = 'gatepass:session-token';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (!storage) return null;
    if (typeof storage.getItem !== 'function') return null;
    if (typeof storage.setItem !== 'function') return null;
    if (typeof storage.removeItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

type SessionValues = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (creds: { email: string; password: string }) => Promise<User>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
  refresh: () => Promise<User | null>;
};

const SessionContext = createContext<SessionValues | null>(null);

function persistToken(value: string | null) {
  const storage = getStorage();
  if (!storage) return;
  if (value) {
    storage.setItem(TOKEN_KEY, value);
  } else {
    storage.removeItem(TOKEN_KEY);
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const activeTokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    activeTokenRef.current = null;
    setToken(null);
    setUser(null);
    persistToken(null);
  }, []);

  const clearTokenIfCurrent = useCallback((tokenValue: string) => {
    const stored = getStorage()?.getItem(TOKEN_KEY) ?? null;
    if (activeTokenRef.current !== tokenValue && stored !== tokenValue) return;
    activeTokenRef.current = null;
    setToken(null);
    setUser(null);
    persistToken(null);
  }, []);

  const loadUser = useCallback(
    async (tokenValue: string) => {
      try {
        setLoading(true);
        activeTokenRef.current = tokenValue;
        const fetched = await fetchCurrentUserRequest(tokenValue);
        setToken(tokenValue);
        setUser(fetched);
        persistToken(tokenValue);
        return fetched;
      } catch (error) {
        clearTokenIfCurrent(tokenValue);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [clearTokenIfCurrent]
  );

  useEffect(() => {
    const storage = getStorage();
    if (!storage) {
      setInitializing(false);
      return;
    }

    const stored = storage.getItem(TOKEN_KEY);
    if (stored) {
      void loadUser(stored).finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, [loadUser]);

  const login = useCallback(async (creds: { email: string; password: string }) => {
    const { token: freshToken, user: freshUser } = await loginRequest(creds);
    activeTokenRef.current = freshToken;
    setToken(freshToken);
    setUser(freshUser);
    persistToken(freshToken);
    return fetchCurrentUserRequest(freshToken)
      .then((verifiedUser) => {
        setUser(verifiedUser);
        return verifiedUser;
      })
      .catch(() => freshUser);
  }, []);

  const setSession = useCallback((sessionToken: string, sessionUser: User) => {
    activeTokenRef.current = sessionToken;
    setToken(sessionToken);
    setUser(sessionUser);
    persistToken(sessionToken);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return null;
    return loadUser(token);
  }, [loadUser, token]);

  const contextValue = useMemo(
    () => ({
      user,
      token,
      loading: initializing || loading,
      login,
      logout,
      setSession,
      refresh,
    }),
    [initializing, loading, user, token, login, logout, setSession, refresh]
  );

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
