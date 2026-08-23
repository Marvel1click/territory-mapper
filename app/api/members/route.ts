import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import { updateMemberSchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext(['admin', 'overseer']);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('congregation_memberships')
      .select('id,user_id,congregation_id,role,status,joined_at,created_at,updated_at,profiles!congregation_memberships_user_id_fkey(id,email,full_name,phone)')
      .eq('congregation_id', context.membership.congregation_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return apiSuccess({ members: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin']);
    throttleMutation(context.userId, 'member-update');
    const input = await parseJson(request, updateMemberSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('update_congregation_member', {
      target_user_id: input.userId,
      target_role: input.role ?? null,
      target_status: input.status ?? null,
    });
    if (error?.message.includes('LAST_ACTIVE_ADMIN')) {
      throw new AppError('CONFLICT', 'Assign another active admin before changing this member.', 409);
    }
    if (error?.message.includes('MEMBER_NOT_FOUND')) {
      throw new AppError('NOT_FOUND', 'Member not found.', 404);
    }
    if (error) throw error;
    return apiSuccess({ member: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
