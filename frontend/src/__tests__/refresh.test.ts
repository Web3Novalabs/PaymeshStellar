import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  silentRefresh,
  resetRefreshState,
  parseJwtPayload,
  scheduleRefresh,
  cancelScheduledRefresh,
} from '@/lib/auth/refresh';
import * as apiClient from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
}));

describe('parseJwtPayload', () => {
  it('parses exp from a valid JWT', () => {
    const payload = { exp: 1700000000 };
    const b64 = btoa(JSON.stringify(payload));
    const token = `header.${b64}.sig`;
    expect(parseJwtPayload(token)).toEqual({ exp: 1700000000 });
  });

  it('returns empty object for malformed token', () => {
    expect(parseJwtPayload('not-a-jwt')).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseJwtPayload('')).toEqual({});
  });
});

describe('single-flight refresh guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiClient.refreshAccessToken).mockReset();
    vi.mocked(apiClient.setAccessToken).mockReset();
    resetRefreshState();
    vi.mocked(apiClient.refreshAccessToken).mockReset();
    vi.mocked(apiClient.setAccessToken).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('N concurrent 401s trigger exactly one refresh request', async () => {
    const mockRefresh = vi.mocked(apiClient.refreshAccessToken);
    let resolveRefresh!: (value: { token: string; address: string }) => void;

    mockRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const CONCURRENT_COUNT = 10;
    const promises: Promise<string | null>[] = [];

    for (let i = 0; i < CONCURRENT_COUNT; i++) {
      promises.push(silentRefresh());
    }

    expect(mockRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh({ token: 'new-token', address: 'GABC' });

    const results = await Promise.all(promises);

    results.forEach((result) => {
      expect(result).toBe('new-token');
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('subsequent calls after resolution trigger a new refresh', async () => {
    const mockRefresh = vi.mocked(apiClient.refreshAccessToken);

    mockRefresh.mockResolvedValueOnce({ token: 'token-1', address: 'G1' });

    const result1 = await silentRefresh();
    expect(result1).toBe('token-1');
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    mockRefresh.mockResolvedValueOnce({ token: 'token-2', address: 'G2' });

    const result2 = await silentRefresh();
    expect(result2).toBe('token-2');
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('returns null on refresh failure and clears access token', async () => {
    const mockRefresh = vi.mocked(apiClient.refreshAccessToken);
    const mockSetToken = vi.mocked(apiClient.setAccessToken);

    mockRefresh.mockRejectedValueOnce(new Error('Network error'));

    const result = await silentRefresh();
    expect(result).toBeNull();
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });
});

describe('scheduleRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiClient.refreshAccessToken).mockReset();
    vi.mocked(apiClient.setAccessToken).mockReset();
    resetRefreshState();
    vi.mocked(apiClient.refreshAccessToken).mockReset();
    vi.mocked(apiClient.setAccessToken).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules refresh before token expiry', () => {
    const mockRefresh = vi.mocked(apiClient.refreshAccessToken);
    mockRefresh.mockResolvedValue({ token: 'new', address: 'G1' });

    const now = Date.now();
    const futureExp = Math.floor(now / 1000) + 600;
    const token = `header.${btoa(JSON.stringify({ exp: futureExp }))}.sig`;

    scheduleRefresh(token);

    expect(mockRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(540_000);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('cancelScheduledRefresh prevents execution', () => {
    const mockRefresh = vi.mocked(apiClient.refreshAccessToken);
    mockRefresh.mockResolvedValue({ token: 'new', address: 'G1' });

    const now = Date.now();
    const futureExp = Math.floor(now / 1000) + 600;
    const token = `header.${btoa(JSON.stringify({ exp: futureExp }))}.sig`;

    scheduleRefresh(token);
    cancelScheduledRefresh();

    vi.advanceTimersByTime(600_000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
