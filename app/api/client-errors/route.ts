import { apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { clientErrorSchema } from '@/app/lib/validation/schemas';
import { logger } from '@/app/lib/utils/logger';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'client-errors');
    const report = await parseJson(request, clientErrorSchema);
    logger.error('Privacy-safe client error', {
      code: report.code,
      message: report.message,
      route: report.route,
      requestId: report.requestId ?? requestId,
      userId: context.userId,
      congregationId: context.membership.congregation_id,
    });
    return apiSuccess({ accepted: true }, requestId, { status: 202 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
