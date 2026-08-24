import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { generateId, getTerritoryCenter } from '@/app/lib/utils';
import { createTerritorySchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (error) throw error;
    return apiSuccess({ territories: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'territory-create');
    const input = await parseJson(request, createTerritorySchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('territories')
      .insert({
        id: generateId(),
        name: input.name,
        description: input.description ?? null,
        congregation_id: context.membership.congregation_id,
        boundary: input.boundary,
        center: getTerritoryCenter(input.boundary.coordinates),
        status: 'in-stock',
        color: input.color,
        created_by: context.userId,
        last_mutation_id: crypto.randomUUID(),
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '42501') throw new AppError('FORBIDDEN', 'You cannot create territories.', 403);
      throw error;
    }
    return apiSuccess({ territory: data }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
