import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { updateHouseSchema } from '@/app/lib/validation/schemas';

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
      .from('houses')
      .select('id,territory_id,congregation_id,address,coordinates,status,notes,is_dnc,last_visited,last_visitor,return_visit_date,created_at,updated_at,version,server_updated_at,deleted_at')
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'House not found.', 404);
    return apiSuccess({ house: data }, requestId);
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
    throttleMutation(context.userId, 'house-update');
    const input = await parseJson(request, updateHouseSchema);
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('houses')
      .update({ ...input, last_mutation_id: crypto.randomUUID() })
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .eq('is_dnc', false)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Editable house not found.', 404);
    delete data.dnc_encrypted_address;
    return apiSuccess({ house: data }, requestId);
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
    throttleMutation(context.userId, 'house-delete');
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('houses')
      .update({ deleted_at: new Date().toISOString(), last_mutation_id: crypto.randomUUID() })
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .select('id,deleted_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'House not found.', 404);
    return apiSuccess({ house: data }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
