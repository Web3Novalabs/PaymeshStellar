import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api/client';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = fetchMock;
  apiClient.setAccessToken(null);
});

describe('API client token management', () => {
  it('setAccessToken and getAccessToken work correctly', () => {
    expect(apiClient.getAccessToken()).toBeNull();

    apiClient.setAccessToken('my-token');
    expect(apiClient.getAccessToken()).toBe('my-token');

    apiClient.setAccessToken(null);
    expect(apiClient.getAccessToken()).toBeNull();
  });

  it('requestChallenge sends correct request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { address: 'GABC', nonce: '123', message: 'test', expiresAt: '2026-01-01' },
        }),
    });

    const result = await apiClient.requestChallenge('GABC');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/auth/challenge',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ address: 'GABC' }),
      })
    );
    expect(result.address).toBe('GABC');
  });

  it('verifyChallenge stores access token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { token: 'jwt-token', address: 'GABC' },
        }),
    });

    const result = await apiClient.verifyChallenge('GABC', 'nonce', 'sig');
    expect(result.token).toBe('jwt-token');
    expect(apiClient.getAccessToken()).toBe('jwt-token');
  });

  it('throws on API error response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid address' },
        }),
    });

    await expect(apiClient.requestChallenge('bad')).rejects.toThrow('Invalid address');
  });

  it('includes Authorization header when token is set', async () => {
    apiClient.setAccessToken('bearer-token');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { groups: [], total: 0 } }),
    });

    await apiClient.apiGet('/api/groups');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/groups',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token',
        }),
      })
    );
  });

  it('does not include Authorization header when no token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { groups: [], total: 0 } }),
    });

    await apiClient.apiGet('/api/groups');

    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });
});
