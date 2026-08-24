import { apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { replicationPullSchema } from '@/app/lib/validation/schemas';
import type { ReplicationDocument, SyncCheckpoint } from '@/app/types';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'replication-pull');
    const input = await parseJson(request, replicationPullSchema);
    const supabase = await createClient();
    let query = supabase
      .from(input.collection)
      .select('*')
      .eq('congregation_id', context.membership.congregation_id)
      .order('server_updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(input.limit);

    if (input.checkpoint) {
      query = query.or(
        `server_updated_at.gt.${input.checkpoint.server_updated_at},and(server_updated_at.eq.${input.checkpoint.server_updated_at},id.gt.${input.checkpoint.id})`,
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    const documents = (data ?? []) as unknown as ReplicationDocument[];
    const last = documents.at(-1);
    const checkpoint: SyncCheckpoint | null = last
      ? { server_updated_at: last.server_updated_at, id: last.id }
      : input.checkpoint ?? null;
    return apiSuccess({ documents, checkpoint }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
