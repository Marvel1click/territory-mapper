'use client';

import { useEffect, useState, useCallback } from 'react';
import { initDatabase, closeDatabase, resetDatabase, type TerritoryDatabase } from '@/app/lib/db/rxdb';
import type { Territory, House, Assignment } from '@/app/types';
import { syncAll, initializeReplication } from '@/app/lib/db/replication/supabase';
import { logger } from '@/app/lib/utils/logger';

// Type for RxDB documents that may have toJSON method
interface RxDocument {
  toJSON?: () => Record<string, unknown>;
}

export function useRxDB(congregationId?: string) {
  const [db, setDb] = useState<TerritoryDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!congregationId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const database = await initDatabase(congregationId);
        if (mounted) {
          setDb(database);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize database'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [congregationId]);

  const close = useCallback(async () => {
    await closeDatabase();
    setDb(null);
  }, []);

  const reset = useCallback(async () => {
    await resetDatabase();
    setDb(null);
  }, []);

  return { db, isLoading, error, close, reset };
}

// Simplified territory hook
export function useTerritories(congregationId?: string) {
  const { db, isLoading: dbLoading, error: dbError } = useRxDB(congregationId);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !congregationId) {
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timeoutId);
    }

    setIsLoading(true);

    const collection = db.territories;
    if (!collection) {
      setIsLoading(false);
      return;
    }

    const query = collection.find({
      selector: { congregation_id: congregationId },
    });

    const subscription = query.$.subscribe({
      next: (docs: unknown[]) => {
        setTerritories(docs.map((doc) => {
          const d = doc as RxDocument;
          return (d.toJSON ? d.toJSON() : doc) as Territory;
        }));
        setIsLoading(false);
      },
      error: (err: Error) => {
        logger.error('Territories subscription error:', err);
        setIsLoading(false);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [db, congregationId]);

  const addTerritory = useCallback(
    async (territory: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.territories;
      return await collection.insert(territory);
    },
    [db]
  );

  const updateTerritory = useCallback(
    async (id: string, updates: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.territories;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.update({ $set: updates });
      }
    },
    [db]
  );

  const deleteTerritory = useCallback(
    async (id: string) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.territories;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.remove();
      }
    },
    [db]
  );

  return {
    territories,
    isLoading: isLoading || dbLoading,
    error: dbError,
    addTerritory,
    updateTerritory,
    deleteTerritory,
  };
}

export function useHouses(territoryId?: string, congregationId?: string) {
  const { db, isLoading: dbLoading } = useRxDB(congregationId);
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timeoutId);
    }

    setIsLoading(true);

    const collection = db.houses;
    if (!collection) {
      setIsLoading(false);
      return;
    }

    // If territoryId is provided, filter by it, otherwise get all for congregation
    const selector: Record<string, string> = congregationId ? { congregation_id: congregationId } : {};
    if (territoryId) {
      selector.territory_id = territoryId;
    }

    const query = collection.find({ selector });

    const subscription = query.$.subscribe({
      next: (docs: unknown[]) => {
        setHouses(docs.map((doc) => {
          const d = doc as RxDocument;
          return (d.toJSON ? d.toJSON() : doc) as House;
        }));
        setIsLoading(false);
      },
      error: () => setIsLoading(false),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [db, territoryId, congregationId]);

  const addHouse = useCallback(
    async (house: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.houses;
      return await collection.insert(house);
    },
    [db]
  );

  const updateHouse = useCallback(
    async (id: string, updates: Partial<House>) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.houses;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.update({ $set: { ...updates, updated_at: new Date().toISOString() } });
      }
    },
    [db]
  );

  const deleteHouse = useCallback(
    async (id: string) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.houses;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.remove();
      }
    },
    [db]
  );

  const bulkAddHouses = useCallback(
    async (houses: unknown[]) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.houses;
      const results = [];
      for (const house of houses) {
        try {
          const result = await collection.insert(house);
          results.push(result);
        } catch (err) {
          logger.error('Failed to insert house:', err);
        }
      }
      return results;
    },
    [db]
  );

  return {
    houses,
    isLoading: isLoading || dbLoading,
    addHouse,
    updateHouse,
    deleteHouse,
    bulkAddHouses,
  };
}

export function useAssignments(congregationId?: string) {
  const { db, isLoading: dbLoading } = useRxDB(congregationId);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !congregationId) {
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timeoutId);
    }

    setIsLoading(true);

    const collection = db.assignments;
    if (!collection) {
      setIsLoading(false);
      return;
    }

    const query = collection.find({
      selector: { congregation_id: congregationId },
    });

    const subscription = query.$.subscribe({
      next: (docs: unknown[]) => {
        setAssignments(docs.map((doc) => {
          const d = doc as RxDocument;
          return (d.toJSON ? d.toJSON() : doc) as Assignment;
        }));
        setIsLoading(false);
      },
      error: () => setIsLoading(false),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [db, congregationId]);

  const addAssignment = useCallback(
    async (assignment: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.assignments;
      return await collection.insert(assignment);
    },
    [db]
  );

  const updateAssignment = useCallback(
    async (id: string, updates: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.assignments;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.update({ $set: updates });
      }
    },
    [db]
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      if (!db) throw new Error('Database not initialized');
      const collection = db.assignments;
      const doc = await collection.findOne(id).exec();
      if (doc) {
        return await doc.remove();
      }
    },
    [db]
  );

  return {
    assignments,
    isLoading: isLoading || dbLoading,
    addAssignment,
    updateAssignment,
    deleteAssignment,
  };
}

// Hook for replication/sync
export function useSync(congregationId?: string) {
  const { db } = useRxDB(congregationId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize replication
  useEffect(() => {
    if (!db || !congregationId) return;

    // Initialize real-time replication
    const cleanup = initializeReplication(db, congregationId, {
      enableRealtime: true,
      syncInterval: 30000, // 30 seconds
    });

    return cleanup;
  }, [db, congregationId]);

  // Manual sync function
  const sync = useCallback(async () => {
    if (!db || !congregationId) {
      throw new Error('Database or congregation not initialized');
    }

    setIsSyncing(true);
    setError(null);

    try {
      const results = await syncAll(db, congregationId);
      const totalPulled = Object.values(results).reduce((sum, r) => sum + r.pulled, 0);
      const totalPushed = Object.values(results).reduce((sum, r) => sum + r.pushed, 0);
      
      setLastSync(new Date().toISOString());
      setPendingChanges(0);
      
      return { pulled: totalPulled, pushed: totalPushed, details: results };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [db, congregationId]);

  return {
    sync,
    isSyncing,
    lastSync,
    pendingChanges,
    error,
  };
}
