import { ApiError } from './apiError';

/**
 * Turns a thrown error (expected: ApiError) into a user-facing message. The backend's exception
 * filter returns RFC 7807 ProblemDetails with a `detail` describing the specific failure (e.g.
 * a 422 for a parent-company cycle, or a 409 when a delete is blocked by existing references) —
 * prefer that over a generic message whenever the server provided one.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail ?? error.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
