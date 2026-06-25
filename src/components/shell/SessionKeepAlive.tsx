'use client';

import { useEffect } from 'react';

const INTERVAL_MS = 10 * 60 * 1000; // 10 min, well inside the ~1h access-token TTL

async function ping(): Promise<void> {
  try {
    await fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' });
  } catch {
    // network hiccup — ignore; the next tick / focus event retries
  }
}

/**
 * Keeps the sealed session cookie fresh while the app is open. Pings the writable
 * refresh route on an interval, on tab re-focus, and on visibility change so the
 * persistable refresh always lands in a Route Handler context (cookies writable)
 * before any RSC render observes token expiry. Holds no token state; renders null.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    const id = setInterval(ping, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ping);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ping);
    };
  }, []);
  return null;
}
