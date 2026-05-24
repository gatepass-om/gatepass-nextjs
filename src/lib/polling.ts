import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => callbackRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
