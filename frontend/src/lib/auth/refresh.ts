import { setAccessToken, refreshAccessToken } from '../api/client';

let refreshPromise: Promise<string | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const REFRESH_BUFFER_MS = 60_000;

export function parseJwtPayload(token: string): { exp?: number } {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    const payload = JSON.parse(atob(parts[1]));
    return { exp: payload.exp };
  } catch {
    return {};
  }
}

export function scheduleRefresh(token: string) {
  cancelScheduledRefresh();

  const payload = parseJwtPayload(token);
  if (!payload.exp) return;

  const expiresAt = payload.exp * 1000;
  const now = Date.now();
  const delay = Math.max(0, expiresAt - now - REFRESH_BUFFER_MS);

  refreshTimer = setTimeout(() => {
    void silentRefresh();
  }, delay);
}

export function cancelScheduledRefresh() {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export async function silentRefresh(): Promise<string | null> {
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const data = await refreshAccessToken();
      scheduleRefresh(data.token);
      return data.token;
    } catch {
      setAccessToken(null);
      cancelScheduledRefresh();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function handleAuthFailure(): Promise<string | null> {
  return silentRefresh() as Promise<string | null>;
}

export function resetRefreshState() {
  cancelScheduledRefresh();
  refreshPromise = null;
  setAccessToken(null);
}
