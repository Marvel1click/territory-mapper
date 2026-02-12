import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { logger } from '@/app/lib/utils/logger';

// Add plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBUpdatePlugin);

// Simple schema definitions
const territorySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object' as const,
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    description: { type: 'string' },
    congregation_id: { type: 'string' },
    boundary: { type: 'object' },
    center: { type: 'array' },
    status: { type: 'string' },
    color: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    created_by: { type: 'string' },
  },
  required: ['id', 'name', 'congregation_id', 'created_at', 'updated_at'],
};

const houseSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object' as const,
  properties: {
    id: { type: 'string', maxLength: 100 },
    territory_id: { type: 'string' },
    congregation_id: { type: 'string' },
    address: { type: 'string' },
    coordinates: { type: 'array' },
    status: { type: 'string' },
    notes: { type: 'string' },
    is_dnc: { type: 'boolean' },
    dnc_encrypted_address: { type: 'string' },
    last_visited: { type: 'string' },
    last_visitor: { type: 'string' },
    return_visit_date: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'territory_id', 'congregation_id', 'address', 'created_at', 'updated_at'],
};

const assignmentSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object' as const,
  properties: {
    id: { type: 'string', maxLength: 100 },
    territory_id: { type: 'string' },
    publisher_id: { type: 'string' },
    publisher_name: { type: 'string' },
    congregation_id: { type: 'string' },
    checked_out_at: { type: 'string' },
    checked_out_by: { type: 'string' },
    due_date: { type: 'string' },
    returned_at: { type: 'string' },
    status: { type: 'string' },
    qr_token: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'territory_id', 'publisher_id', 'congregation_id', 'checked_out_at', 'created_at'],
};

const syncStateSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object' as const,
  properties: {
    id: { type: 'string', maxLength: 100 },
    collection: { type: 'string' },
    last_sync: { type: 'string' },
    pending_changes: { type: 'number' },
    sync_status: { type: 'string' },
    error: { type: 'string' },
  },
  required: ['id', 'collection'],
};

// Define database collections type
export interface TerritoryCollections {
  territories: RxCollection;
  houses: RxCollection;
  assignments: RxCollection;
  sync_state: RxCollection;
}

export type TerritoryDatabase = RxDatabase<TerritoryCollections>;

let dbPromise: Promise<TerritoryDatabase> | null = null;

// Initialize database
export async function initDatabase(congregationId: string): Promise<TerritoryDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = createRxDatabase<TerritoryCollections>({
    name: `territory_mapper_${congregationId}`,
    storage: getRxStorageDexie(),
    multiInstance: false,
    ignoreDuplicate: true,
  }).then(async (db) => {
    await db.addCollections({
      territories: { schema: territorySchema },
      houses: { schema: houseSchema },
      assignments: { schema: assignmentSchema },
      sync_state: { schema: syncStateSchema },
    });
    
    logger.info('[RxDB] Database initialized');
    return db;
  });
  
  return dbPromise;
}

// Get existing database instance
export async function getDatabase(): Promise<TerritoryDatabase | null> {
  return dbPromise ? await dbPromise : null;
}

// Close database
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await (db as unknown as { destroy: () => Promise<void> }).destroy();
    dbPromise = null;
    logger.info('[RxDB] Database closed');
  }
}

// Reset database (for logout)
export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  dbPromise = null;
}
