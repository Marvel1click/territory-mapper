import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { applyVisitEffects } from '@/app/lib/domain/visits';
import { createVisitSchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const url = new URL(request.url);
    const supabase = await createClient();
    let query = supabase
      .from('visits')
      .select('*,houses(address,coordinates),territories(name)')
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null);
    const territoryId = url.searchParams.get('territory_id');
    if (territoryId) query = query.eq('territory_id', territoryId);
    if (url.searchParams.get('return_visits') === 'true') {
      query = query.not('follow_up_at', 'is', null).order('follow_up_at', { ascending: true });
    } else {
      query = query.order('visited_at', { ascending: false });
    }
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return apiSuccess({ visits: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'visit-create');
    const input = await parseJson(request, createVisitSchema);
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('visits')
      .select('*')
      .eq('mutation_id', input.mutationId)
      .maybeSingle();
    if (existing) {
      await applyVisitEffects(supabase, {
        visitId: existing.id,
        houseId: input.houseId,
        territoryId: input.territoryId,
        congregationId: context.membership.congregation_id,
        visitorId: context.userId,
        outcome: input.outcome,
        notes: input.notes,
        visitedAt: existing.visited_at,
        followUpAt: input.followUpAt,
      });
      return apiSuccess({ visit: existing, idempotent: true }, requestId);
    }

    const { data: visit, error } = await supabase.rpc('append_visit', {
      target_id: input.id,
      target_house_id: input.houseId,
      target_territory_id: input.territoryId,
      target_outcome: input.outcome,
      target_notes: input.outcome === 'do-not-call' ? null : input.notes ?? null,
      target_visited_at: input.visitedAt,
      target_follow_up_at: input.followUpAt ?? null,
      target_mutation_id: input.mutationId,
    });
    if (error) {
      if (error.code === '42501') {
        throw new AppError('FORBIDDEN', 'This house is not in one of your active assignments.', 403);
      }
      throw error;
    }
    if (!visit) throw new AppError('INTERNAL_ERROR', 'The visit could not be recorded.', 500);

    try {
      await applyVisitEffects(supabase, {
        visitId: visit.id,
        houseId: input.houseId,
        territoryId: input.territoryId,
        congregationId: context.membership.congregation_id,
        visitorId: context.userId,
        outcome: input.outcome,
        notes: input.notes,
        visitedAt: visit.visited_at,
        followUpAt: input.followUpAt,
      });
    } catch (effectError) {
      if (effectError instanceof Error && effectError.message === 'VISIT_HOUSE_NOT_FOUND') {
        throw new AppError('NOT_FOUND', 'House not found.', 404);
      }
      throw effectError;
    }

    return apiSuccess({ visit, idempotent: false }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
