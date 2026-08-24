import { apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { requireAuthContext } from '@/app/lib/auth/context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    return apiSuccess(
      { profile: context.profile, membership: context.membership },
      requestId,
    );
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
