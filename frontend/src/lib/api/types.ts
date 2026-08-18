export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiFailure {
  success: false;
  error: ApiErrorPayload;
}
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string;
  retries?: number;
}
