'use client';

import { useEffect, useRef } from 'react';
import { useLiveEventsContext } from '@/providers/live-events-provider';
import type { LiveEvent } from '@/lib/sse';

type Options = {
  /** When false the handler is not registered (e.g. the feature is gated by role). Defaults to true. */
  enabled?: boolean;
};

/**
 * Registers a handler on the app's single shared `/events/me` live stream for the lifetime of the component. The
 * handler is held in a ref so parent re-renders never re-subscribe. Pages keep a slow polling fallback for
 * resilience when the stream is unavailable.
 */
export function useLiveEvents(onEvent: (event: LiveEvent) => void, options?: Options): void {
  const context = useLiveEventsContext();
  const enabled = options?.enabled ?? true;
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!context || !enabled) return;
    return context.subscribe((event) => handlerRef.current(event));
  }, [context, enabled]);
}
