import { apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const supabase = await createClient();
    const isManager = context.membership.role === 'admin' || context.membership.role === 'overseer';
    const congregationId = context.membership.congregation_id;

    if (isManager) {
      const [territories, available, assignments, members, returnVisits, visits, activity] =
        await Promise.all([
          supabase.from('territories').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).is('deleted_at', null),
          supabase.from('territories').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).eq('status', 'in-stock').is('deleted_at', null),
          supabase.from('assignments').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).eq('status', 'active').is('deleted_at', null),
          supabase.from('congregation_memberships').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).eq('status', 'active'),
          supabase.from('visits').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).not('follow_up_at', 'is', null).is('deleted_at', null),
          supabase.from('visits').select('id', { count: 'exact', head: true })
            .eq('congregation_id', congregationId).is('deleted_at', null),
          supabase.from('activity_log')
            .select('id,action,entity_type,entity_id,created_at')
            .eq('congregation_id', congregationId)
            .order('created_at', { ascending: false })
            .limit(8),
        ]);
      const firstError = [territories, available, assignments, members, returnVisits, visits, activity]
        .find((result) => result.error)?.error;
      if (firstError) throw firstError;
      return apiSuccess(
        {
          summary: {
            territories: territories.count ?? 0,
            available: available.count ?? 0,
            activeAssignments: assignments.count ?? 0,
            activeMembers: members.count ?? 0,
            returnVisits: returnVisits.count ?? 0,
            visits: visits.count ?? 0,
          },
          activity: activity.data ?? [],
        },
        requestId,
      );
    }

    const [assignments, returnVisits, visits] = await Promise.all([
      supabase.from('assignments').select('id,territory_id,due_date,checked_out_at,territories(name)')
        .eq('publisher_id', context.userId).eq('status', 'active').is('deleted_at', null)
        .order('checked_out_at', { ascending: false }),
      supabase.from('visits').select('id', { count: 'exact', head: true })
        .eq('visitor_id', context.userId).not('follow_up_at', 'is', null).is('deleted_at', null),
      supabase.from('visits').select('id,house_id,outcome,visited_at,territories(name)')
        .eq('visitor_id', context.userId).is('deleted_at', null)
        .order('visited_at', { ascending: false }).limit(8),
    ]);
    const firstError = [assignments, returnVisits, visits].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    return apiSuccess(
      {
        summary: {
          activeAssignments: assignments.data?.length ?? 0,
          returnVisits: returnVisits.count ?? 0,
          visits: visits.data?.length ?? 0,
        },
        assignments: assignments.data ?? [],
        activity: visits.data ?? [],
      },
      requestId,
    );
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
