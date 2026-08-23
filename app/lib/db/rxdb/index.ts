import {
  addRxPlugin,
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import { logger } from '@/app/lib/utils/logger';

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBUpdatePlugin);

const nullableString = { type: ['string', 'null'] } as const;
const replicatedProperties = {
  version: { type: 'number', minimum: 1, default: 1 },
  server_updated_at: { type: 'string', maxLength: 40 },
  deleted_at: nullableString,
  last_mutation_id: nullableString,
} as const;

const territorySchema = {
  title: 'territory',
  version: 1,
  keyCompression: false,
  primaryKey: 'id',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string', maxLength: 120 },
    description: nullableString,
    congregation_id: { type: 'string', maxLength: 40 },
    boundary: { type: 'object' },
    center: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    status: { type: 'string', enum: ['in-stock', 'out', 'pending'] },
    color: { type: 'string', maxLength: 20 },
    created_by: { type: 'string', maxLength: 40 },
    created_at: { type: 'string', maxLength: 40 },
    updated_at: { type: 'string', maxLength: 40 },
    ...replicatedProperties,
  },
  required: [
    'id', 'name', 'congregation_id', 'boundary', 'center', 'status', 'color',
    'created_by', 'created_at', 'updated_at', 'version', 'server_updated_at',
  ],
  indexes: ['congregation_id', 'status', ['server_updated_at', 'id']],
} as const;

const houseSchema = {
  title: 'house',
  version: 1,
  keyCompression: false,
  primaryKey: 'id',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 100 },
    territory_id: { type: 'string', maxLength: 100 },
    congregation_id: { type: 'string', maxLength: 40 },
    address: { type: 'string', maxLength: 500 },
    coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    status: {
      type: 'string',
      enum: ['not-visited', 'nah', 'interest', 'return-visit'],
    },
    notes: nullableString,
    is_dnc: { type: 'boolean', default: false },
    last_visited: nullableString,
    last_visitor: nullableString,
    return_visit_date: nullableString,
    created_at: { type: 'string', maxLength: 40 },
    updated_at: { type: 'string', maxLength: 40 },
    ...replicatedProperties,
  },
  required: [
    'id', 'territory_id', 'congregation_id', 'address', 'coordinates', 'status',
    'is_dnc', 'created_at', 'updated_at', 'version', 'server_updated_at',
  ],
  indexes: ['territory_id', 'congregation_id', 'status', ['server_updated_at', 'id']],
} as const;

const assignmentSchema = {
  title: 'assignment',
  version: 1,
  keyCompression: false,
  primaryKey: 'id',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 100 },
    territory_id: { type: 'string', maxLength: 100 },
    publisher_id: { type: 'string', maxLength: 40 },
    publisher_name: { type: 'string', maxLength: 160 },
    congregation_id: { type: 'string', maxLength: 40 },
    checked_out_at: { type: 'string', maxLength: 40 },
    checked_out_by: { type: 'string', maxLength: 40 },
    due_date: nullableString,
    returned_at: nullableString,
    status: { type: 'string', enum: ['active', 'returned', 'overdue'] },
    created_at: { type: 'string', maxLength: 40 },
    updated_at: { type: 'string', maxLength: 40 },
    ...replicatedProperties,
  },
  required: [
    'id', 'territory_id', 'publisher_id', 'publisher_name', 'congregation_id',
    'checked_out_at', 'checked_out_by', 'status', 'created_at', 'updated_at',
    'version', 'server_updated_at',
  ],
  indexes: ['publisher_id', 'congregation_id', 'status', ['server_updated_at', 'id']],
} as const;

const visitSchema = {
  title: 'visit',
  version: 1,
  keyCompression: false,
  primaryKey: 'id',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 100 },
    house_id: { type: 'string', maxLength: 100 },
    territory_id: { type: 'string', maxLength: 100 },
    congregation_id: { type: 'string', maxLength: 40 },
    visitor_id: { type: 'string', maxLength: 40 },
    outcome: {
      type: 'string',
      enum: ['not-home', 'contacted', 'interested', 'return-visit', 'do-not-call'],
    },
    notes: nullableString,
    visited_at: { type: 'string', maxLength: 40 },
    follow_up_at: nullableString,
    mutation_id: { type: 'string', maxLength: 40 },
    created_at: { type: 'string', maxLength: 40 },
    version: { type: 'number', minimum: 1, default: 1 },
    server_updated_at: { type: 'string', maxLength: 40 },
    deleted_at: nullableString,
  },
  required: [
    'id', 'house_id', 'territory_id', 'congregation_id', 'visitor_id', 'outcome',
    'visited_at', 'mutation_id', 'created_at', 'version', 'server_updated_at',
  ],
  indexes: ['territory_id', 'visitor_id', 'follow_up_at', ['server_updated_at', 'id']],
} as const;

const syncStateSchema = {
  title: 'sync state',
  version: 1,
  keyCompression: false,
  primaryKey: 'id',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 100 },
    collection: { type: 'string', maxLength: 40 },
    offline_ready: { type: 'boolean', default: false },
    basemap_ready: { type: 'boolean', default: false },
    pending_changes: { type: 'number', minimum: 0, default: 0 },
    sync_status: { type: 'string', enum: ['idle', 'syncing', 'error'], default: 'idle' },
    last_successful_sync: nullableString,
    last_error: nullableString,
  },
  required: ['id', 'collection', 'offline_ready', 'basemap_ready', 'pending_changes', 'sync_status'],
} as const;

export interface LocalDocument extends Record<string, unknown> {
  id: string;
  congregation_id?: string;
  _deleted: boolean;
}

export interface TerritoryCollections {
  territories: RxCollection<LocalDocument>;
  houses: RxCollection<LocalDocument>;
  assignments: RxCollection<LocalDocument>;
  visits: RxCollection<LocalDocument>;
  sync_state: RxCollection<LocalDocument>;
}

export type TerritoryDatabase = RxDatabase<TerritoryCollections>;

let dbPromise: Promise<TerritoryDatabase> | null = null;
let activeIdentity: string | null = null;

function migrateReplicatedDocument(oldData: Record<string, unknown>): Record<string, unknown> {
  return {
    ...oldData,
    version: typeof oldData.version === 'number' ? oldData.version : 1,
    server_updated_at:
      typeof oldData.server_updated_at === 'string'
        ? oldData.server_updated_at
        : String(oldData.updated_at ?? new Date(0).toISOString()),
    deleted_at: oldData.deleted_at ?? null,
    last_mutation_id: oldData.last_mutation_id ?? null,
  };
}

export async function initDatabase(congregationId: string): Promise<TerritoryDatabase> {
  const client = getSupabaseClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  if (!data.user) throw new Error('A signed-in user is required for offline storage.');
  const identity = `${congregationId}_${data.user.id}`.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

  if (dbPromise && activeIdentity === identity) return dbPromise;
  if (dbPromise) await closeDatabase();
  activeIdentity = identity;

  dbPromise = createRxDatabase<TerritoryCollections>({
    name: `territory_mapper_${identity}`,
    storage: getRxStorageDexie(),
    multiInstance: true,
    ignoreDuplicate: true,
  }).then(async (db) => {
    await db.addCollections({
      territories: {
        schema: territorySchema,
        migrationStrategies: { 1: migrateReplicatedDocument },
      },
      houses: {
        schema: houseSchema,
        migrationStrategies: {
          1: (oldData: Record<string, unknown>) =>
            oldData.is_dnc ? null : migrateReplicatedDocument(oldData),
        },
      },
      assignments: {
        schema: assignmentSchema,
        migrationStrategies: {
          1: (oldData: Record<string, unknown>) => {
            const migrated = migrateReplicatedDocument(oldData);
            delete migrated.qr_token;
            return migrated;
          },
        },
      },
      visits: { schema: visitSchema, migrationStrategies: { 1: migrateReplicatedDocument } },
      sync_state: {
        schema: syncStateSchema,
        migrationStrategies: {
          1: (oldData: Record<string, unknown>) => ({
            id: oldData.id,
            collection: oldData.collection,
            offline_ready: false,
            basemap_ready: false,
            pending_changes: Number(oldData.pending_changes ?? 0),
            sync_status: oldData.sync_status ?? 'idle',
            last_successful_sync: oldData.last_sync ?? null,
            last_error: oldData.error ?? null,
          }),
        },
      },
    });
    logger.info('[RxDB] User-scoped offline database initialized');
    return db;
  });

  return dbPromise;
}

export async function getDatabase(): Promise<TerritoryDatabase | null> {
  return dbPromise ? dbPromise : null;
}

export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.close();
  dbPromise = null;
  activeIdentity = null;
}

export async function resetDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.remove();
  dbPromise = null;
  activeIdentity = null;
  logger.info('[RxDB] User-scoped offline data removed');
}
