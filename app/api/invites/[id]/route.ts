import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin']);
    throttleMutation(context.userId, 'invite-revoke');
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('congregation_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('id,revoked_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Active invitation not found.', 404);
    return apiSuccess({ invite: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
