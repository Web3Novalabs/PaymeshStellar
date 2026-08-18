import { NetworkError, toApiError } from './errors';
import type { ApiEnvelope, RequestOptions } from './types';
const RETRYABLE = new Set([408,425,429,500,502,503,504]);
function isEnvelope<T>(v: unknown): v is ApiEnvelope<T> { if (!v || typeof v !== 'object' || !('success' in v)) return false; return (v as {success: unknown}).success === true ? 'data' in v : (v as {success: unknown}).success === false && 'error' in v; }
function wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
export interface ApiClientOptions { baseUrl?: string; getAccessToken?: () => string | undefined | Promise<string | undefined>; fetcher?: typeof fetch; }
export class ApiClient {
  private readonly baseUrl: string; private readonly getAccessToken?: ApiClientOptions['getAccessToken']; private readonly fetcher: typeof fetch;
  constructor(o: ApiClientOptions = {}) { this.baseUrl = o.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? ''; this.getAccessToken = o.getAccessToken; this.fetcher = o.fetcher ?? fetch; }
  async request<T>(path: string, o: RequestOptions = {}): Promise<T> { const method = (o.method ?? 'GET').toUpperCase(); const retries = method === 'GET' ? (o.retries ?? 2) : 0; const headers = new Headers(o.headers); headers.set('Accept','application/json'); if (o.body !== undefined) headers.set('Content-Type','application/json'); const token = o.token ?? await this.getAccessToken?.(); if (token) headers.set('Authorization', `Bearer ${token}`); let attempt = 0; while (true) { try { const res = await this.fetcher(path.startsWith('http') ? path : `${this.baseUrl}${path}`, {...o, method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body)}); const raw: unknown = await res.json().catch(() => undefined); if (!isEnvelope<T>(raw)) throw toApiError({code: res.ok ? 'UNKNOWN_ERROR' : 'INTERNAL_ERROR', message: 'The server returned an invalid response.'}, res.status); if (!raw.success) throw toApiError(raw.error, res.status); return raw.data; } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') throw e; if (e instanceof TypeError) { if (attempt >= retries) throw new NetworkError(e.message); } else if (e instanceof Error && 'status' in e) { const s = (e as {status: unknown}).status; if (typeof s !== 'number' || attempt >= retries || !RETRYABLE.has(s)) throw e; } else throw e; await wait(100 * 2 ** attempt); attempt++; } } }
  get<T>(p: string, o?: Omit<RequestOptions,'method'|'body'>) { return this.request<T>(p,{...o,method:'GET'}); }
  post<T>(p: string,b?: unknown,o?: Omit<RequestOptions,'method'|'body'>) { return this.request<T>(p,{...o,method:'POST',body:b}); }
  put<T>(p: string,b?: unknown,o?: Omit<RequestOptions,'method'|'body'>) { return this.request<T>(p,{...o,method:'PUT',body:b}); }
  delete<T>(p: string,o?: Omit<RequestOptions,'method'|'body'>) { return this.request<T>(p,{...o,method:'DELETE'}); }
}
export const apiClient = new ApiClient();
