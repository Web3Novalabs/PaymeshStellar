import type { ApiResponse, AuthChallenge, AuthTokens } from '../wallet/types';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body: ApiResponse<T> = await res.json();

  if (!body.success) {
    throw new Error(body.error.message);
  }

  return body.data;
}

export async function requestChallenge(address: string): Promise<AuthChallenge> {
  return request<AuthChallenge>('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export async function verifyChallenge(
  address: string,
  nonce: string,
  signature: string
): Promise<AuthTokens> {
  const data = await request<AuthTokens>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, nonce, signature }),
  });

  setAccessToken(data.token);
  return data;
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  const data = await request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  setAccessToken(data.token);
  return data;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};
