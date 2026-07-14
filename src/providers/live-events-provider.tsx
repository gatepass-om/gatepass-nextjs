'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useSession } from './session-provider';
import { streamLiveEvents, type LiveEvent } from '@/lib/sse';

type Handler = (event: LiveEvent) => void;

type LiveEventsContextValue = {
  /** Register a handler for live events. Returns an unsubscribe function. */
  subscribe: (handler: Handler) => () => void;
};

const LiveEventsContext = createContext<LiveEventsContextValue | null>(null);

/**
 * Holds ONE scope-filtered SSE connection (`/events/me`) for the whole app and fans events out to every subscriber,
 * instead of each feature opening its own connection. Reconnects with exponential backoff and re-opens with a fresh
 * token whenever the session token changes (the session provider refreshes it ahead of expiry).
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const handlers = useRef<Set<Handler>>(new Set());

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let attempt = 0;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          await streamLiveEvents({
            token,
            signal: controller.signal,
            onEvent: (event) => {
              handlers.current.forEach((handler) => {
                // One subscriber throwing must never break the shared stream for the others.
                try {
                  handler(event);
                } catch {
                  /* ignore */
                }
              });
            },
            onStatusChange: (status) => {
              if (status === 'open') attempt = 0;
            },
          });
        } catch {
          // Connection failed or dropped — fall through to backoff.
        }

        if (cancelled) return;

        attempt += 1;
        const backoffMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
        await new Promise<void>((resolve) => {
          reconnectTimer = setTimeout(resolve, backoffMs);
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [token]);

  return <LiveEventsContext.Provider value={{ subscribe }}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEventsContext(): LiveEventsContextValue | null {
  return useContext(LiveEventsContext);
}
