import { NextResponse } from 'next/server';
import type { ApiError, ApiErrorCode } from '@/app/types';
import { logger } from '@/app/lib/utils/logger';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

export function apiErrorResponse(
  error: AppError,
  requestId: string,
): NextResponse<ApiError> {
  if (error.status >= 500) {
    logger.error('api_request_failed', {
      requestId,
      code: error.code,
      status: error.status,
      error,
    });
  }
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId,
    },
    {
      status: error.status,
      headers: {
        'cache-control': 'no-store',
        'x-request-id': requestId,
      },
    },
  );
}

export function apiSuccess<T extends object>(
  data: T,
  requestId: string,
  init: ResponseInit = {},
): NextResponse<T & { requestId: string }> {
  const headers = new Headers(init.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-request-id', requestId);
  return NextResponse.json(
    { ...data, requestId },
    { ...init, headers },
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
}
