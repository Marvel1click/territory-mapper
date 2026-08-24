import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { getTerritoryCenter } from '@/app/lib/utils';
import { updateTerritorySchema } from '@/app/lib/validation/schemas';

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
      .from('territories')
      .select('*')
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Territory not found.', 404);
    return apiSuccess({ territory: data }, requestId);
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
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'territory-update');
    const input = await parseJson(request, updateTerritorySchema);
    const { id } = await params;
    const { version, ...changes } = input;
    const updates = {
      ...changes,
      ...(changes.boundary ? { center: getTerritoryCenter(changes.boundary.coordinates) } : {}),
      last_mutation_id: crypto.randomUUID(),
    };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('territories')
      .update(updates)
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .eq('version', version)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: current } = await supabase
        .from('territories')
        .select('id')
        .eq('id', id)
        .eq('congregation_id', context.membership.congregation_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (current) {
        throw new AppError(
          'CONFLICT',
          'This territory changed elsewhere. Refresh, review the latest boundary, then reapply your edit.',
          409,
        );
      }
      throw new AppError('NOT_FOUND', 'Territory not found.', 404);
    }
    return apiSuccess({ territory: data }, requestId);
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
    throttleMutation(context.userId, 'territory-delete');
    const { id } = await params;
    const supabase = await createClient();
    const { data: active } = await supabase
      .from('assignments')
      .select('id')
      .eq('territory_id', id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(1);
    if (active?.length) {
      throw new AppError('CONFLICT', 'Return the active assignment before archiving this territory.', 409);
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('territories')
      .update({ deleted_at: now, last_mutation_id: crypto.randomUUID() })
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .select('id,deleted_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Territory not found.', 404);
    return apiSuccess({ territory: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
