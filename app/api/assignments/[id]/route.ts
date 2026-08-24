import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import { returnAssignmentSchema } from '@/app/lib/validation/schemas';

function returnError(message?: string): AppError {
  if (message?.includes('ASSIGNMENT_NOT_FOUND')) {
    return new AppError('NOT_FOUND', 'Active assignment not found.', 404);
  }
  if (message?.includes('FORBIDDEN')) {
    return new AppError('FORBIDDEN', 'You cannot return this assignment.', 403);
  }
  return new AppError('INTERNAL_ERROR', 'The assignment could not be returned.', 500);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('*,territories(name)')
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Assignment not found.', 404);
    return apiSuccess({ assignment: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'assignment-return');
    const input = await parseJson(request, returnAssignmentSchema.passthrough());
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('return_assignment', {
      target_assignment_id: id,
      target_mutation_id: input.mutationId,
    });
    if (error) throw returnError(error.message);
    return apiSuccess({ assignment: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'assignment-revoke');
    const { id } = await params;
    const supabase = await createClient();
    const { data: current } = await supabase
      .from('assignments')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (!current) throw new AppError('NOT_FOUND', 'Assignment not found.', 404);
    if (current.status === 'active') {
      const { error: returnRpcError } = await supabase.rpc('return_assignment', {
        target_assignment_id: id,
        target_mutation_id: crypto.randomUUID(),
      });
      if (returnRpcError) throw returnError(returnRpcError.message);
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .select('id,deleted_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Assignment not found.', 404);
    return apiSuccess({ assignment: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
