'use client';

import { fetchCurrentUserRequest, impersonateUserRequest, loginRequest, logoutRequest, refreshSessionRequest, setSessionBridge } from '@/lib/api';
import type { User } from '@/lib/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Refresh this far ahead of the access token's actual expiry.
const REFRESH_SKEW_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

function getSessionExpiry(result: { expiresAt?: string; expiresAtUtc?: string }) {
  return result.expiresAtUtc ?? result.expiresAt;
}

// Serialize refreshes across all tabs of this origin via the Web Locks API. Two tabs sending the rotating
// refresh cookie concurrently would trip server-side reuse detection and log the user out everywhere.
async function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
    return navigator.locks.request('gatepass:refresh', run);
  }
  return run();
}

type SessionValues = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isImpersonating: boolean;
  impersonatedBy: User['impersonatedBy'];
  login: (creds: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  setSession: (token: string, user: User, expiresAt?: string) => void;
  refresh: () => Promise<User | null>;
  startImpersonation: (userId: string) => Promise<User>;
  stopImpersonation: () => Promise<void>;
};

const SessionContext = createContext<SessionValues | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // The access token lives only in memory — never localStorage — so XSS cannot exfiltrate it. The refresh
  // token rides in an httpOnly cookie the browser sends to /auth automatically.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [impersonation, setImpersonation] = useState<{ adminToken: string; adminUser: User; adminExpiresAt?: string } | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRefresh = useRef<Promise<User | null> | null>(null);
  const silentRefreshRef = useRef<() => Promise<User | null>>(async () => null);
  const tokenRef = useRef<string | null>(null);
  const impersonationRef = useRef<typeof impersonation>(null);
  const expiresAtRef = useRef<string | undefined>(undefined);
  const mounted = useRef(true);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearRefreshTimer();
    tokenRef.current = null;
    expiresAtRef.current = undefined;
    setToken(null);
    setUser(null);
    setImpersonation(null);
  }, [clearRefreshTimer]);

  const scheduleRefresh = useCallback((expiresAt?: string) => {
    clearRefreshTimer();
    if (!expiresAt) return;
    const expiryMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryMs)) return;
    const delay = Math.max(MIN_REFRESH_DELAY_MS, expiryMs - Date.now() - REFRESH_SKEW_MS);
    refreshTimer.current = setTimeout(() => {
      void silentRefreshRef.current();
    }, delay);
  }, [clearRefreshTimer]);

  const applySession = useCallback((nextToken: string, nextUser: User, expiresAt?: string) => {
    tokenRef.current = nextToken;
    expiresAtRef.current = expiresAt;
    setToken(nextToken);
    setUser(nextUser);
    scheduleRefresh(expiresAt);
  }, [scheduleRefresh]);

  useEffect(() => {
    impersonationRef.current = impersonation;
  }, [impersonation]);

  // Silent token refresh via the httpOnly cookie. Concurrent callers share a single in-flight request so the
  // same (rotating) refresh cookie is never sent twice — doing so would trip server-side reuse detection and
  // revoke the whole token family.
  const silentRefresh = useCallback(async (): Promise<User | null> => {
    if (impersonationRef.current) return null;
    if (inFlightRefresh.current) return inFlightRefresh.current;
	    const promise = (async () => {
	      try {
	        const result = await withRefreshLock(() => refreshSessionRequest());
	        if (mounted.current) applySession(result.token, result.user, getSessionExpiry(result));
	        return result.user;
      } catch {
        if (mounted.current) clearSession();
        return null;
      } finally {
        inFlightRefresh.current = null;
      }
    })();
    inFlightRefresh.current = promise;
    return promise;
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
  }, [silentRefresh]);

  // Let the API layer transparently recover from a 401 (expired access token) by performing one shared silent
  // refresh and retrying. tokenRef is updated synchronously by applySession, so it holds the rotated token here.
  useEffect(() => {
    setSessionBridge({
      refresh: async () => {
        await silentRefresh();
        return tokenRef.current;
      },
    });
    return () => setSessionBridge(null);
  }, [silentRefresh]);

  // Bootstrap: attempt to restore a session from the refresh cookie on first load (and after a hard reload,
  // when the in-memory access token is gone).
  useEffect(() => {
    mounted.current = true;
    void silentRefresh().finally(() => {
      if (mounted.current) setInitializing(false);
    });
    return () => {
      mounted.current = false;
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (creds: { email: string; password: string }) => {
    setLoading(true);
    try {
	      const result = await loginRequest(creds);
	      applySession(result.token, result.user, getSessionExpiry(result));
	      return result.user;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const startImpersonation = useCallback(async (userId: string) => {
    if (!tokenRef.current || !user) throw new Error('No active admin session.');
    const adminSession = {
      adminToken: tokenRef.current,
      adminUser: user,
      adminExpiresAt: expiresAtRef.current,
    };
    const result = await impersonateUserRequest(tokenRef.current, userId);
    setImpersonation(adminSession);
    tokenRef.current = result.token;
    expiresAtRef.current = getSessionExpiry(result);
    setToken(result.token);
    setUser(result.user);
    clearRefreshTimer();
    return result.user;
  }, [clearRefreshTimer, user]);

  const stopImpersonation = useCallback(async () => {
    const adminSession = impersonationRef.current;
    if (!adminSession) return;
    setImpersonation(null);
    impersonationRef.current = null;

    const expiryMs = adminSession.adminExpiresAt ? new Date(adminSession.adminExpiresAt).getTime() : Number.NaN;
    if (!Number.isNaN(expiryMs) && expiryMs > Date.now() + MIN_REFRESH_DELAY_MS) {
      applySession(adminSession.adminToken, adminSession.adminUser, adminSession.adminExpiresAt);
      return;
    }

    const restored = await silentRefresh();
    if (!restored) {
      applySession(adminSession.adminToken, adminSession.adminUser, adminSession.adminExpiresAt);
    }
  }, [applySession, silentRefresh]);

  const logout = useCallback(async () => {
    clearSession();
    try {
      await logoutRequest();
    } catch {
      // Best-effort: local state is already cleared and the cookie will lapse regardless.
    }
  }, [clearSession]);

  const setSession = useCallback((sessionToken: string, sessionUser: User, expiresAt?: string) => {
    applySession(sessionToken, sessionUser, expiresAt);
  }, [applySession]);

  // Re-validate the live session (called on navigation). If the in-memory access token is rejected, fall back
  // to a silent token refresh before giving up.
  const refresh = useCallback(async (): Promise<User | null> => {
    if (impersonation) return user;
    if (!token) return null;
    try {
      const verified = await fetchCurrentUserRequest(token);
      if (mounted.current) setUser(verified);
      return verified;
    } catch {
      return silentRefresh();
    }
  }, [impersonation, silentRefresh, token, user]);

  const contextValue = useMemo<SessionValues>(
    () => ({
      user,
      token,
      loading: initializing || loading,
      isImpersonating: !!impersonation,
      impersonatedBy: user?.impersonatedBy ?? null,
      login,
      logout,
      setSession,
      refresh,
      startImpersonation,
      stopImpersonation,
    }),
    [initializing, loading, user, token, impersonation, login, logout, setSession, refresh, startImpersonation, stopImpersonation]
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
