import type { ApiError } from '@/app/types';

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'INTERNAL_ERROR',
    public readonly requestId?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ClientApiError';
  }
}

export async function apiFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T | ApiError;
  if (!response.ok) {
    const failure = body as ApiError;
    throw new ClientApiError(
      failure.error?.message ?? 'The request could not be completed.',
      failure.error?.code,
      failure.requestId,
      response.status,
    );
  }
  return body as T;
}

export function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.requestId ? `${error.message} (Request ${error.requestId})` : error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
