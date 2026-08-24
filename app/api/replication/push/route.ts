import { z } from 'zod';
import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createClient } from '@/app/lib/db/supabase/server';
import { applyVisitEffects } from '@/app/lib/domain/visits';
import { assumedMasterMatches, replicationResolution } from '@/app/lib/domain/replication';
import { replicationPushSchema } from '@/app/lib/validation/schemas';
import type {
  ReplicatedCollection,
  ReplicationConflict,
  ReplicationDocument,
  VisitOutcome,
} from '@/app/types';

const documentIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const mutationIdSchema = z.uuid();

const allowedFields: Record<ReplicatedCollection, ReadonlySet<string>> = {
  territories: new Set([
    'id', 'name', 'description', 'boundary', 'center', 'status', 'color',
    'created_at', 'created_by', 'deleted_at', 'last_mutation_id',
  ]),
  houses: new Set([
    'id', 'territory_id', 'address', 'coordinates', 'status', 'notes',
    'last_visited', 'last_visitor', 'return_visit_date', 'created_at',
    'deleted_at', 'last_mutation_id',
  ]),
  assignments: new Set(),
  visits: new Set([
    'id', 'house_id', 'territory_id', 'outcome', 'notes', 'visited_at',
    'follow_up_at', 'mutation_id', 'deleted_at',
  ]),
};

function pickAllowed(
  document: Record<string, unknown>,
  collection: ReplicatedCollection,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (allowedFields[collection].has(key)) result[key] = value;
  }
  return result;
}

function asReplicationDocument(value: unknown): ReplicationDocument {
  return value as ReplicationDocument;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'replication-push');
    const input = await parseJson(request, replicationPushSchema);
    if (
      context.membership.role === 'publisher' && input.collection !== 'visits' ||
      input.collection === 'assignments'
    ) {
      throw new AppError(
        'FORBIDDEN',
        input.collection === 'assignments'
          ? 'Assignments must use the transactional checkout and return endpoints.'
          : 'Publishers can only upload append-only field visits.',
        403,
      );
    }

    const supabase = await createClient();
    const conflicts: ReplicationConflict[] = [];
    const documents: ReplicationDocument[] = [];

    for (const row of input.rows) {
      const newState = row.newDocumentState;
      const id = documentIdSchema.parse(newState.id);
      const mutationId = mutationIdSchema.parse(
        newState.last_mutation_id ?? newState.mutation_id,
      );
      const { data: current, error: currentError } = await supabase
        .from(input.collection)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (currentError) throw currentError;
      const currentDocument = current ? asReplicationDocument(current) : null;

      const isIdempotent =
        currentDocument?.last_mutation_id === mutationId ||
        input.collection === 'visits' && currentDocument?.mutation_id === mutationId;
      if (isIdempotent && currentDocument) {
        if (input.collection === 'visits') {
          await applyVisitEffects(supabase, {
            visitId: currentDocument.id,
            houseId: String(currentDocument.house_id),
            territoryId: String(currentDocument.territory_id),
            congregationId: context.membership.congregation_id,
            visitorId: context.userId,
            outcome: currentDocument.outcome as VisitOutcome,
            notes: newState.outcome === 'do-not-call'
              ? String(newState.notes ?? '') || null
              : currentDocument.notes ? String(currentDocument.notes) : null,
            visitedAt: String(currentDocument.visited_at),
            followUpAt: currentDocument.follow_up_at
              ? String(currentDocument.follow_up_at)
              : null,
          });
        }
        documents.push(currentDocument);
        continue;
      }

      const assumed = row.assumedMasterState
        ? asReplicationDocument(row.assumedMasterState)
        : null;
      const assumedMatches = assumedMasterMatches(currentDocument, assumed);

      if (!assumedMatches) {
        if (currentDocument) {
          conflicts.push({
            id,
            collection: input.collection,
            assumed_master: assumed,
            server_document: currentDocument,
            client_document: asReplicationDocument(newState),
            resolution: replicationResolution(input.collection),
          });
        }
        continue;
      }

      const payload: Record<string, unknown> = {
        ...pickAllowed(newState, input.collection),
        id,
        congregation_id: context.membership.congregation_id,
        ...(input.collection === 'visits'
          ? { visitor_id: context.userId, mutation_id: mutationId }
          : { last_mutation_id: mutationId }),
      };
      if (input.collection === 'visits' && payload.outcome === 'do-not-call') {
        payload.notes = null;
      }
      if (newState._deleted === true) {
        payload.deleted_at = new Date().toISOString();
      }

      if (input.collection === 'houses' && payload.status === 'dnc') {
        throw new AppError(
          'VALIDATION_FAILED',
          'DNC changes must use the restricted DNC endpoint.',
          400,
        );
      }

      if (currentDocument) {
        const { data: updated, error: updateError } = await supabase
          .from(input.collection)
          .update(payload)
          .eq('id', id)
          .eq('version', assumed?.version ?? -1)
          .select('*')
          .maybeSingle();
        if (updateError) throw updateError;
        if (!updated) {
          const { data: raced } = await supabase
            .from(input.collection)
            .select('*')
            .eq('id', id)
            .single();
          if (raced) {
            conflicts.push({
              id,
              collection: input.collection,
              assumed_master: assumed,
              server_document: asReplicationDocument(raced),
              client_document: asReplicationDocument(newState),
              resolution: replicationResolution(input.collection),
            });
          }
        } else {
          documents.push(asReplicationDocument(updated));
        }
      } else {
        if (input.collection === 'visits') {
          const { data: inserted, error: insertError } = await supabase.rpc('append_visit', {
            target_id: id,
            target_house_id: String(payload.house_id),
            target_territory_id: String(payload.territory_id),
            target_outcome: String(payload.outcome),
            target_notes: payload.notes ? String(payload.notes) : null,
            target_visited_at: String(payload.visited_at),
            target_follow_up_at: payload.follow_up_at ? String(payload.follow_up_at) : null,
            target_mutation_id: mutationId,
          });
          if (insertError) throw insertError;
          if (inserted) {
            const insertedDocument = asReplicationDocument(inserted);
            documents.push(insertedDocument);
            await applyVisitEffects(supabase, {
              visitId: insertedDocument.id,
              houseId: String(insertedDocument.house_id),
              territoryId: String(insertedDocument.territory_id),
              congregationId: context.membership.congregation_id,
              visitorId: context.userId,
              outcome: insertedDocument.outcome as VisitOutcome,
              notes: newState.outcome === 'do-not-call'
                ? String(newState.notes ?? '') || null
                : insertedDocument.notes ? String(insertedDocument.notes) : null,
              visitedAt: String(insertedDocument.visited_at),
              followUpAt: insertedDocument.follow_up_at
                ? String(insertedDocument.follow_up_at)
                : null,
            });
          }
          continue;
        }
        const { data: inserted, error: insertError } = await supabase
          .from(input.collection)
          .insert(payload)
          .select('*')
          .maybeSingle();
        if (insertError?.code === '23505') {
          const { data: raced } = await supabase
            .from(input.collection)
            .select('*')
            .eq('id', id)
            .single();
          conflicts.push({
            id,
            collection: input.collection,
            assumed_master: assumed,
            server_document: asReplicationDocument(raced),
            client_document: asReplicationDocument(newState),
            resolution: replicationResolution(input.collection),
          });
        } else if (insertError) {
          throw insertError;
        } else if (inserted) {
          documents.push(asReplicationDocument(inserted));
        }
      }
    }

    return apiSuccess({ documents, conflicts }, requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        new AppError('VALIDATION_FAILED', 'A replication document is invalid.', 400),
        requestId,
      );
    }
    return apiErrorResponse(toAppError(error), requestId);
  }
}
