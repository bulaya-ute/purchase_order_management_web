import { ApiError } from './apiError';
import type { ProblemDetails } from './apiError';

/**
 * Same relative base as client.ts — required for the httpOnly session cookie to round-trip
 * same-origin in both dev (Vite proxy) and production.
 */
const API_BASE = '/api';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Files.FileDto. */
export interface UploadedFile {
  id: number;
  url: string;
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
}

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

/**
 * Uploads a file via multipart/form-data to POST /api/files (field name "file") and returns the
 * created FileDto. Deliberately does NOT set a Content-Type header — letting the browser compute
 * it (including the multipart boundary) is required for the server to parse the form correctly;
 * setting it manually on a FormData body breaks the boundary and the request fails to bind.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const problem = await parseErrorBody(response);
    const message = problem?.detail ?? problem?.title ?? response.statusText ?? 'Upload failed';
    throw new ApiError(response.status, message, problem);
  }

  return (await response.json()) as UploadedFile;
}
