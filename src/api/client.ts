import { ApiError } from './apiError';
import type { ProblemDetails } from './apiError';

/**
 * Relative base so requests are same-origin in dev (proxied by Vite, see
 * vite.config.ts) and in production (served from the same host as the API,
 * or behind a reverse proxy that maps /api through). This is required for
 * the httpOnly, Secure, SameSite=Strict session cookie to round-trip.
 */
const API_BASE = '/api';

type JsonBody = Record<string, unknown> | unknown[];

/** Caller-supplied options, excluding the bits the client controls itself (method/body/credentials). */
type RequestOptions = Omit<RequestInit, 'method' | 'body' | 'credentials'>;

async function parseErrorBody(response: Response): Promise<ProblemDetails | undefined> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('problem+json')) {
    return undefined;
  }
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return undefined;
  }
}

async function request<TResponse>(
  path: string,
  method: string,
  body?: JsonBody,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { headers, ...rest } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const problem = await parseErrorBody(response);
    const message = problem?.detail ?? problem?.title ?? response.statusText ?? 'Request failed';
    throw new ApiError(response.status, message, problem);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, 'GET', undefined, options),

  post: <TResponse>(path: string, body?: JsonBody, options?: RequestOptions) =>
    request<TResponse>(path, 'POST', body, options),

  put: <TResponse>(path: string, body?: JsonBody, options?: RequestOptions) =>
    request<TResponse>(path, 'PUT', body, options),

  patch: <TResponse>(path: string, body?: JsonBody, options?: RequestOptions) =>
    request<TResponse>(path, 'PATCH', body, options),

  delete: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>(path, 'DELETE', undefined, options),
};
