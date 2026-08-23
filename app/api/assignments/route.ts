import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { assignTerritorySchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

function assignmentError(message?: string): AppError {
  if (message?.includes('TERRITORY_ALREADY_ASSIGNED')) {
    return new AppError('CONFLICT', 'This territory is already checked out.', 409);
  }
  if (message?.includes('TERRITORY_NOT_FOUND')) {
    return new AppError('NOT_FOUND', 'Territory not found.', 404);
  }
  if (message?.includes('PUBLISHER_NOT_IN_CONGREGATION')) {
    return new AppError('FORBIDDEN', 'The selected publisher is not an active member.', 403);
  }
  if (message?.includes('FORBIDDEN')) {
    return new AppError('FORBIDDEN', 'You cannot assign territories.', 403);
  }
  return new AppError('INTERNAL_ERROR', 'The territory could not be checked out.', 500);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const supabase = await createClient();
    const url = new URL(request.url);
    let query = supabase
      .from('assignments')
      .select('*,territories(name)')
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null);

    const status = url.searchParams.get('status');
    const territoryId = url.searchParams.get('territory_id');
    const publisherId = url.searchParams.get('publisher_id');
    if (status) query = query.eq('status', status);
    if (territoryId) query = query.eq('territory_id', territoryId);
    if (publisherId && context.membership.role !== 'publisher') {
      query = query.eq('publisher_id', publisherId);
    }

    const { data, error } = await query.order('checked_out_at', { ascending: false });
    if (error) throw error;
    const assignments = (data ?? []).map((assignment) => {
      const territory = assignment.territories as unknown as { name: string } | null;
      const { territories: _territories, ...rest } = assignment;
      return { ...rest, territory_name: territory?.name ?? 'Unknown territory' };
    });
    return apiSuccess({ assignments }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'assignment-create');
    const input = await parseJson(request, assignTerritorySchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('assign_territory', {
      target_territory_id: input.territoryId,
      target_publisher_id: input.publisherId,
      target_due_date: input.dueDate ?? null,
      target_mutation_id: input.mutationId,
    });
    if (error) throw assignmentError(error.message);
    return apiSuccess({ assignment: data }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
