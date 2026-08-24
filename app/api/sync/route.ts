import { AppError, apiErrorResponse, getRequestId } from '@/app/lib/api/errors';

function retired(request: Request) {
  return apiErrorResponse(
    new AppError(
      'CONFLICT',
      'The legacy sync endpoint has been retired. Use /api/replication/pull and /api/replication/push.',
      410,
    ),
    getRequestId(request),
  );
}

export const GET = retired;
export const POST = retired;
