/** Shape of an RFC 7807 ProblemDetails response, as returned by the API's exception filter. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/** Thrown by the API client for any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = problem?.detail;
    this.problem = problem;
  }
}
