import {
  replicateRxCollection,
  type RxReplicationState,
} from 'rxdb/plugins/replication';
import type { RxReplicationWriteToMasterRow } from 'rxdb';
import type {
  ReplicatedCollection,
  ReplicationConflict,
  ReplicationDocument,
  SyncCheckpoint,
} from '@/app/types';
import type {
  LocalDocument,
  TerritoryDatabase,
} from '@/app/lib/db/rxdb';
import { logger } from '@/app/lib/utils/logger';
import { useSyncStore } from '@/app/lib/store';

type ReplicationCollection = 'territories' | 'houses' | 'assignments' | 'visits';

interface PullResponse {
  documents: ReplicationDocument[];
  checkpoint: SyncCheckpoint | null;
}

interface PushResponse {
  documents: ReplicationDocument[];
  conflicts: ReplicationConflict[];
}

export interface CollectionReplicationStatus {
  active: boolean;
  received: number;
  sent: number;
  conflicts: number;
  error: string | null;
  lastSuccessfulSync: string | null;
}

const collectionFields: Record<ReplicationCollection, readonly string[]> = {
  territories: [
    'id', 'name', 'description', 'congregation_id', 'boundary', 'center', 'status',
    'color', 'created_by', 'created_at', 'updated_at', 'version',
    'server_updated_at', 'deleted_at', 'last_mutation_id',
  ],
  houses: [
    'id', 'territory_id', 'congregation_id', 'address', 'coordinates', 'status',
    'notes', 'is_dnc', 'last_visited', 'last_visitor', 'return_visit_date',
    'created_at', 'updated_at', 'version', 'server_updated_at', 'deleted_at',
    'last_mutation_id',
  ],
  assignments: [
    'id', 'territory_id', 'publisher_id', 'publisher_name', 'congregation_id',
    'checked_out_at', 'checked_out_by', 'due_date', 'returned_at', 'status',
    'created_at', 'updated_at', 'version', 'server_updated_at', 'deleted_at',
    'last_mutation_id',
  ],
  visits: [
    'id', 'house_id', 'territory_id', 'congregation_id', 'visitor_id', 'outcome',
    'notes', 'visited_at', 'follow_up_at', 'mutation_id', 'created_at', 'version',
    'server_updated_at', 'deleted_at',
  ],
};

const statuses = new Map<ReplicationCollection, CollectionReplicationStatus>();
const stateBundles = new WeakMap<TerritoryDatabase, ReplicationBundle>();

interface ReplicationBundle {
  states: Map<ReplicationCollection, RxReplicationState<LocalDocument, SyncCheckpoint>>;
  interval: ReturnType<typeof setInterval>;
  cleanupListeners: () => void;
  references: number;
}

function getStatus(collection: ReplicationCollection): CollectionReplicationStatus {
  const existing = statuses.get(collection);
  if (existing) return existing;
  const status: CollectionReplicationStatus = {
    active: false,
    received: 0,
    sent: 0,
    conflicts: 0,
    error: null,
    lastSuccessfulSync: null,
  };
  statuses.set(collection, status);
  return status;
}

function toLocalDocument(
  collection: ReplicationCollection,
  serverDocument: ReplicationDocument,
): LocalDocument {
  const local: Record<string, unknown> = {};
  for (const key of collectionFields[collection]) {
    if (key in serverDocument) local[key] = serverDocument[key];
  }
  local._deleted = Boolean(serverDocument.deleted_at);
  return local as LocalDocument;
}

function toPushRow(
  collection: ReplicationCollection,
  row: RxReplicationWriteToMasterRow<LocalDocument>,
): {
  newDocumentState: Record<string, unknown>;
  assumedMasterState: Record<string, unknown> | null;
} {
  const serialize = (document: LocalDocument | undefined): Record<string, unknown> | null => {
    if (!document) return null;
    const serialized: Record<string, unknown> = {};
    for (const key of [...collectionFields[collection], '_deleted']) {
      if (key in document) serialized[key] = document[key];
    }
    return serialized;
  };
  return {
    newDocumentState: serialize(row.newDocumentState) ?? {},
    assumedMasterState: serialize(row.assumedMasterState),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? body.error?.code ?? 'Replication request failed.');
  }
  return body;
}

function createReplication(
  db: TerritoryDatabase,
  collection: ReplicationCollection,
  congregationId: string,
): RxReplicationState<LocalDocument, SyncCheckpoint> {
  const status = getStatus(collection);
  const state = replicateRxCollection<LocalDocument, SyncCheckpoint>({
    replicationIdentifier: `territory-mapper-v2:${location.origin}:${congregationId}:${collection}`,
    collection: db[collection],
    live: true,
    retryTime: 5_000,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: 100,
      async handler(checkpoint, batchSize) {
        const response = await fetch('/api/replication/pull', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ collection, checkpoint: checkpoint ?? null, limit: batchSize }),
        });
        const result = await parseResponse<PullResponse>(response);
        status.lastSuccessfulSync = new Date().toISOString();
        status.error = null;
        useSyncStore.getState().setLastSync(status.lastSuccessfulSync);
        useSyncStore.getState().setOfflineDataReady(true);
        useSyncStore.getState().setSyncError(null);
        return {
          documents: result.documents.map((document) => toLocalDocument(collection, document)),
          checkpoint: result.checkpoint ?? undefined,
        };
      },
    },
    ...(collection === 'visits'
      ? {
          push: {
            batchSize: 50,
            async handler(rows: RxReplicationWriteToMasterRow<LocalDocument>[]) {
              const response = await fetch('/api/replication/push', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  collection,
                  rows: rows.map((row) => toPushRow(collection, row)),
                }),
              });
              const result = await parseResponse<PushResponse>(response);
              status.lastSuccessfulSync = new Date().toISOString();
              status.error = null;
              useSyncStore.getState().setLastSync(status.lastSuccessfulSync);
              useSyncStore.getState().setSyncError(null);
              return result.conflicts.map((conflict) =>
                toLocalDocument(collection, conflict.server_document),
              );
            },
          },
        }
      : {}),
  });

  state.active$.subscribe((active) => {
    status.active = active;
    useSyncStore.getState().setSyncing(
      [...statuses.values()].some((collectionStatus) => collectionStatus.active),
    );
    if (!active && !status.error) status.lastSuccessfulSync = new Date().toISOString();
  });
  state.received$.subscribe(() => {
    status.received += 1;
  });
  state.sent$.subscribe(() => {
    status.sent += 1;
    const pending = useSyncStore.getState().pendingChanges;
    useSyncStore.getState().setPendingChanges(Math.max(0, pending - 1));
  });
  state.conflict$.subscribe(() => {
    status.conflicts += 1;
  });
  state.error$.subscribe((error) => {
    status.error = error.message;
    useSyncStore.getState().setSyncError('Some field changes could not synchronize. Retry when online.');
    logger.error(`[Replication] ${collection} failed`, { message: error.message });
  });
  return state;
}

function ensureBundle(db: TerritoryDatabase, congregationId: string): ReplicationBundle {
  const existing = stateBundles.get(db);
  if (existing) {
    existing.references += 1;
    return existing;
  }
  const states = new Map<ReplicationCollection, RxReplicationState<LocalDocument, SyncCheckpoint>>();
  for (const collection of ['territories', 'houses', 'assignments', 'visits'] as const) {
    states.set(collection, createReplication(db, collection, congregationId));
  }
  const reSync = () => states.forEach((state) => state.reSync());
  const interval = setInterval(reSync, 30_000);
  window.addEventListener('online', reSync);
  const setOnline = () => useSyncStore.getState().setOnline(true);
  const setOffline = () => useSyncStore.getState().setOnline(false);
  useSyncStore.getState().setOnline(navigator.onLine);
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOffline);
  const bundle = { states, interval, cleanupListeners: () => {
    window.removeEventListener('online', reSync);
    window.removeEventListener('online', setOnline);
    window.removeEventListener('offline', setOffline);
  }, references: 1 };
  stateBundles.set(db, bundle);
  return bundle;
}

export function initializeReplication(
  db: TerritoryDatabase,
  congregationId: string,
): () => void {
  const bundle = ensureBundle(db, congregationId);
  return () => {
    bundle.references -= 1;
    if (bundle.references > 0) return;
    clearInterval(bundle.interval);
    bundle.cleanupListeners();
    bundle.states.forEach((state) => void state.cancel());
    stateBundles.delete(db);
  };
}

export async function syncAll(
  db: TerritoryDatabase,
  congregationId: string,
): Promise<Record<string, { pulled: number; pushed: number }>> {
  const bundle = stateBundles.get(db) ?? ensureBundle(db, congregationId);
  const before = new Map(
    [...statuses.entries()].map(([name, status]) => [name, { ...status }]),
  );
  bundle.states.forEach((state) => state.reSync());
  await Promise.all([...bundle.states.values()].map((state) => state.awaitInSync()));
  return Object.fromEntries(
    [...bundle.states.keys()].map((name) => {
      const current = getStatus(name);
      const previous = before.get(name);
      return [
        name,
        {
          pulled: current.received - (previous?.received ?? 0),
          pushed: current.sent - (previous?.sent ?? 0),
        },
      ];
    }),
  );
}

export function getReplicationStatus(
  collection?: ReplicatedCollection,
): CollectionReplicationStatus | Map<ReplicationCollection, CollectionReplicationStatus> {
  if (collection) return getStatus(collection);
  return statuses;
}

export function resetReplicationStatus(): void {
  statuses.clear();
}
