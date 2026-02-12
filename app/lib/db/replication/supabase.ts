/**
 * RxDB to Supabase Replication Layer
 * 
 * This module handles bidirectional sync between the local RxDB database
 * and the Supabase PostgreSQL database.
 */

import { type RxCollection } from 'rxdb';
import { supabase } from '../supabase/client';
import { logger } from '@/app/lib/utils/logger';
import type { TerritoryDatabase } from '../rxdb';

// Replication state
interface ReplicationState {
  isActive: boolean;
  lastSync: string | null;
  pendingChanges: number;
  error: string | null;
}

// Document from Supabase replication
interface ReplicationDoc {
  id: string;
  updated_at: string;
  [key: string]: unknown;
}

// Realtime payload types
type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeEventType;
  new: T;
  old: { id: string };
}

// Type guard for payload validation
function isValidPayload(payload: unknown): payload is RealtimePayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.eventType === 'string' &&
    ['INSERT', 'UPDATE', 'DELETE'].includes(p.eventType) &&
    typeof p.new === 'object' &&
    (p.old === undefined || typeof p.old === 'object')
  );
}

const replicationStates = new Map<string, ReplicationState>();

// Get or create replication state for a collection
function getReplicationState(collectionName: string): ReplicationState {
  if (!replicationStates.has(collectionName)) {
    replicationStates.set(collectionName, {
      isActive: false,
      lastSync: null,
      pendingChanges: 0,
      error: null,
    });
  }
  return replicationStates.get(collectionName)!;
}

/**
 * Pull changes from Supabase to RxDB
 */
export async function pullFromSupabase(
  db: TerritoryDatabase,
  collectionName: 'territories' | 'houses' | 'assignments',
  congregationId: string,
  since?: string
): Promise<number> {
  try {
    const state = getReplicationState(collectionName);
    state.isActive = true;

    // Build query
    let query = supabase
      .from(collectionName)
      .select('*')
      .eq('congregation_id', congregationId);

    // If we have a last sync time, only get records updated since then
    if (since) {
      query = query.gt('updated_at', since);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      state.isActive = false;
      return 0;
    }

    // Insert or update records in RxDB
    const collection = db[collectionName] as RxCollection;
    const docs = data as ReplicationDoc[];

    for (const doc of docs) {
      try {
        // Check if document exists
        const existing = await collection.findOne(doc.id).exec();
        
        if (existing) {
          // Update if server version is newer
          const serverTime = new Date(doc.updated_at).getTime();
          const localTime = new Date(existing.updated_at).getTime();
          
          if (serverTime > localTime) {
            await existing.update({ $set: doc });
          }
        } else {
          // Insert new document
          await collection.insert(doc);
        }
      } catch (err) {
        logger.error(`[Replication] Error processing ${collectionName} doc ${doc.id}:`, err);
      }
    }

    // Update last sync time
    const lastUpdated = docs[docs.length - 1]?.updated_at;
    if (lastUpdated) {
      state.lastSync = lastUpdated;
    }

    state.isActive = false;
    return docs.length;
  } catch (error) {
    const state = getReplicationState(collectionName);
    state.isActive = false;
    state.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Replication] Pull error for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Push changes from RxDB to Supabase
 */
export async function pushToSupabase(
  db: TerritoryDatabase,
  collectionName: 'territories' | 'houses' | 'assignments',
  congregationId: string
): Promise<number> {
  try {
    const state = getReplicationState(collectionName);
    state.isActive = true;

    const collection = db[collectionName] as RxCollection;
    
    // Get all documents that need to be synced
    // For simplicity, we sync all documents modified since last sync
    const since = state.lastSync;
    
    const query = collection.find({
      selector: { congregation_id: congregationId },
    });

    const docs = await query.exec();
    
    // Filter for documents that need syncing
    const docsToSync = since 
      ? docs.filter((doc: { updated_at?: string }) => new Date(doc.updated_at || 0) > new Date(since))
      : docs;

    if (docsToSync.length === 0) {
      state.isActive = false;
      return 0;
    }

    // Convert to plain objects for Supabase
    const records = docsToSync.map((doc: { toJSON?: () => Record<string, unknown> }) => {
      const data = doc.toJSON ? doc.toJSON() : (doc as Record<string, unknown>);
      // Remove RxDB internal fields
      delete data._rev;
      delete data._attachments;
      delete data._meta;
      return data;
    });

    // Upsert to Supabase
    const { error } = await supabase
      .from(collectionName)
      .upsert(records, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (error) {
      throw error;
    }

    // Update last sync time
    const lastRecord = records[records.length - 1];
    if (lastRecord?.updated_at && typeof lastRecord.updated_at === 'string') {
      state.lastSync = lastRecord.updated_at;
    }

    state.pendingChanges = 0;
    state.isActive = false;
    return records.length;
  } catch (error) {
    const state = getReplicationState(collectionName);
    state.isActive = false;
    state.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Replication] Push error for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Bidirectional sync - pull then push
 */
export async function syncCollection(
  db: TerritoryDatabase,
  collectionName: 'territories' | 'houses' | 'assignments',
  congregationId: string
): Promise<{ pulled: number; pushed: number }> {
  const since = getReplicationState(collectionName).lastSync || undefined;
  
  // First pull from server
  const pulled = await pullFromSupabase(db, collectionName, congregationId, since);
  
  // Then push local changes
  const pushed = await pushToSupabase(db, collectionName, congregationId);
  
  return { pulled, pushed };
}

/**
 * Sync all collections
 */
export async function syncAll(
  db: TerritoryDatabase,
  congregationId: string
): Promise<Record<string, { pulled: number; pushed: number }>> {
  const results: Record<string, { pulled: number; pushed: number }> = {};
  
  const collections: Array<'territories' | 'houses' | 'assignments'> = [
    'territories',
    'houses',
    'assignments',
  ];

  for (const collectionName of collections) {
    try {
      results[collectionName] = await syncCollection(db, collectionName, congregationId);
    } catch (error) {
      logger.error(`[Replication] Failed to sync ${collectionName}:`, error);
      results[collectionName] = { pulled: 0, pushed: 0 };
    }
  }

  return results;
}

/**
 * Get replication status
 */
export function getReplicationStatus(collectionName?: string): ReplicationState | Map<string, ReplicationState> {
  if (collectionName) {
    return getReplicationState(collectionName);
  }
  return replicationStates;
}

/**
 * Subscribe to real-time changes from Supabase
 */
export function subscribeToChanges<T = Record<string, unknown>>(
  collectionName: 'territories' | 'houses' | 'assignments',
  congregationId: string,
  callback: (payload: RealtimePayload<T>) => void
): () => void {
  const channel = supabase
    .channel(`${collectionName}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: collectionName,
        filter: `congregation_id=eq.${congregationId}`,
      },
      (payload: unknown) => {
        if (!isValidPayload(payload)) {
          logger.warn('[Replication] Invalid payload received:', payload);
          return;
        }
        callback(payload as RealtimePayload<T>);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Initialize replication for all collections
 * Sets up real-time subscriptions and periodic sync
 */
export function initializeReplication(
  db: TerritoryDatabase,
  congregationId: string,
  options: {
    enableRealtime?: boolean;
    syncInterval?: number;
  } = {}
): () => void {
  const { enableRealtime = true, syncInterval = 30000 } = options;

  const unsubscribers: Array<() => void> = [];

  // Set up real-time subscriptions
  if (enableRealtime) {
    const collections: Array<'territories' | 'houses' | 'assignments'> = [
      'territories',
      'houses',
      'assignments',
    ];

    for (const collectionName of collections) {
      const unsubscribe = subscribeToChanges(
        collectionName,
        congregationId,
        async (payload) => {
          // Handle real-time update
          const collection = db[collectionName] as RxCollection;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const doc = payload.new as Record<string, unknown>;
            const docId = typeof doc.id === 'string' ? doc.id : undefined;
            if (!docId) {
              logger.warn('[Replication] Document missing id:', doc);
              return;
            }
            try {
              const existing = await collection.findOne(docId).exec();
              if (existing) {
                await existing.update({ $set: doc });
              } else {
                await collection.insert(doc);
              }
            } catch (err) {
              logger.error(`[Replication] Real-time update error:`, err);
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Record<string, unknown>).id;
            if (typeof oldId !== 'string') {
              logger.warn('[Replication] Delete payload missing id:', payload.old);
              return;
            }
            try {
              const existing = await collection.findOne(oldId).exec();
              if (existing) {
                await existing.remove();
              }
            } catch (err) {
              logger.error(`[Replication] Real-time delete error:`, err);
            }
          }
        }
      );
      
      unsubscribers.push(unsubscribe);
    }
  }

  // Set up periodic sync
  const intervalId = setInterval(() => {
    syncAll(db, congregationId).catch((err) => {
      logger.error('[Replication] Periodic sync error:', err);
    });
  }, syncInterval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    unsubscribers.forEach((unsub) => unsub());
  };
}
