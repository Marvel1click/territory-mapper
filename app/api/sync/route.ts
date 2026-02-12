/**
 * Sync API Routes
 *
 * POST /api/sync - Bulk sync data from client to server
 * GET /api/sync - Get sync status and pending changes
 *
 * This endpoint handles bulk synchronization for offline-first architecture.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { logger } from '@/app/lib/utils/logger';

interface HouseRecord {
  id: string;
  address: string;
  is_dnc: boolean;
  dnc_encrypted_address?: string;
  [key: string]: unknown;
}

interface AssignmentRecord {
  id: string;
  territory_id: string;
  territories?: { name: string };
  [key: string]: unknown;
}

// Field allowlists - only these fields will be accepted during sync
const TERRITORY_ALLOWED_FIELDS = new Set([
  'id', 'name', 'description', 'congregation_id', 'boundary', 'center',
  'status', 'color', 'created_at', 'updated_at', 'created_by',
]);

const HOUSE_ALLOWED_FIELDS = new Set([
  'id', 'territory_id', 'congregation_id', 'address', 'coordinates',
  'status', 'notes', 'is_dnc', 'dnc_encrypted_address',
  'last_visited', 'last_visitor', 'return_visit_date',
  'created_at', 'updated_at',
]);

const ASSIGNMENT_ALLOWED_FIELDS = new Set([
  'id', 'territory_id', 'publisher_id', 'publisher_name',
  'congregation_id', 'checked_out_at', 'checked_out_by',
  'due_date', 'returned_at', 'status', 'qr_token',
  'created_at', 'updated_at',
]);

/** Strip a record down to only allowed fields */
function pickAllowedFields<T extends Record<string, unknown>>(
  record: T,
  allowedFields: Set<string>
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (allowedFields.has(key)) {
      result[key] = record[key];
    }
  }
  return result as Partial<T>;
}

// GET /api/sync - Get server sync status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    // Fetch changed data since last sync
    const results: Record<string, HouseRecord[] | AssignmentRecord[] | unknown[]> = {};

    // Get changed territories
    let territoryQuery = supabase
      .from('territories')
      .select('*')
      .eq('congregation_id', congregationId);

    if (since) {
      territoryQuery = territoryQuery.gt('updated_at', since);
    }

    const { data: territories } = await territoryQuery;
    results.territories = territories || [];

    // Get changed houses
    let houseQuery = supabase
      .from('houses')
      .select('*')
      .eq('congregation_id', congregationId);

    if (since) {
      houseQuery = houseQuery.gt('updated_at', since);
    }

    const { data: houses } = await houseQuery;
    // Hide DNC addresses
    results.houses = (houses || []).map((h: HouseRecord) => ({
      ...h,
      address: h.is_dnc ? 'Do Not Call' : h.address,
      dnc_encrypted_address: undefined,
    }));

    // Get changed assignments
    let assignmentQuery = supabase
      .from('assignments')
      .select('*')
      .eq('congregation_id', congregationId);

    if (since) {
      assignmentQuery = assignmentQuery.gt('updated_at', since);
    }

    const { data: assignments } = await assignmentQuery;
    results.assignments = assignments || [];

    return NextResponse.json({
      data: results,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching sync data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sync - Bulk sync from client
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;
    const body = await request.json();

    const {
      territories = [],
      houses = [],
      assignments = []
    } = body;

    // Limit batch sizes to prevent abuse
    const MAX_BATCH_SIZE = 500;
    if (territories.length > MAX_BATCH_SIZE || houses.length > MAX_BATCH_SIZE || assignments.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} records per collection` },
        { status: 400 }
      );
    }

    const results: Record<string, { inserted: number; updated: number; errors: number }> = {
      territories: { inserted: 0, updated: 0, errors: 0 },
      houses: { inserted: 0, updated: 0, errors: 0 },
      assignments: { inserted: 0, updated: 0, errors: 0 },
    };

    // Process territories
    for (const rawTerritory of territories) {
      try {
        if (rawTerritory.congregation_id !== congregationId) {
          continue;
        }

        // Strip to allowed fields only
        const territory = pickAllowedFields(rawTerritory, TERRITORY_ALLOWED_FIELDS);

        const { error } = await supabase
          .from('territories')
          .upsert({
            ...territory,
            congregation_id: congregationId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) {
          logger.error('Error upserting territory:', error);
          results.territories.errors++;
        } else {
          results.territories.updated++;
        }
      } catch (err) {
        logger.error('Error processing territory:', err);
        results.territories.errors++;
      }
    }

    // Process houses
    for (const rawHouse of houses) {
      try {
        if (rawHouse.congregation_id !== congregationId) {
          continue;
        }

        const house = pickAllowedFields(rawHouse, HOUSE_ALLOWED_FIELDS);

        const { error } = await supabase
          .from('houses')
          .upsert({
            ...house,
            congregation_id: congregationId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) {
          logger.error('Error upserting house:', error);
          results.houses.errors++;
        } else {
          results.houses.updated++;
        }
      } catch (err) {
        logger.error('Error processing house:', err);
        results.houses.errors++;
      }
    }

    // Process assignments
    for (const rawAssignment of assignments) {
      try {
        if (rawAssignment.congregation_id !== congregationId) {
          continue;
        }

        const assignment = pickAllowedFields(rawAssignment, ASSIGNMENT_ALLOWED_FIELDS);

        const { error } = await supabase
          .from('assignments')
          .upsert({
            ...assignment,
            congregation_id: congregationId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (error) {
          logger.error('Error upserting assignment:', error);
          results.assignments.errors++;
        } else {
          results.assignments.updated++;
        }
      } catch (err) {
        logger.error('Error processing assignment:', err);
        results.assignments.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error syncing data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
