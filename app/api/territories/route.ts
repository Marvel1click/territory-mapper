/**
 * Territories API Routes
 * 
 * GET /api/territories - List all territories for user's congregation
 * POST /api/territories - Create a new territory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { generateId, getTerritoryCenter } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { validateString, validateBoundary, validateColor, MAX_LENGTHS } from '@/app/lib/utils/validation';

// GET /api/territories
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's congregation
    const congregationId = user.user_metadata.congregation_id;
    
    if (!congregationId) {
      return NextResponse.json(
        { error: 'User not associated with a congregation' },
        { status: 400 }
      );
    }

    // Fetch territories
    const { data: territories, error } = await supabase
      .from('territories')
      .select('*')
      .eq('congregation_id', congregationId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching territories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch territories' },
        { status: 500 }
      );
    }

    return NextResponse.json({ territories });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/territories
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is overseer or admin
    const role = user.user_metadata.role;
    if (role !== 'overseer' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;
    
    if (!congregationId) {
      return NextResponse.json(
        { error: 'User not associated with a congregation' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, boundary, color = '#3b82f6' } = body;

    // Validate required fields
    if (!name || !boundary) {
      return NextResponse.json(
        { error: 'Name and boundary are required' },
        { status: 400 }
      );
    }

    if (!validateString(name, MAX_LENGTHS.name)) {
      return NextResponse.json(
        { error: `Name must be a string of at most ${MAX_LENGTHS.name} characters` },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && !validateString(description, MAX_LENGTHS.description)) {
      return NextResponse.json(
        { error: `Description must be at most ${MAX_LENGTHS.description} characters` },
        { status: 400 }
      );
    }

    if (!validateBoundary(boundary)) {
      return NextResponse.json(
        { error: 'Invalid boundary: must be a valid GeoJSON Polygon' },
        { status: 400 }
      );
    }

    if (color && !validateColor(color)) {
      return NextResponse.json(
        { error: 'Invalid color: must be a hex color (e.g., #3b82f6)' },
        { status: 400 }
      );
    }

    // Calculate center from boundary
    const center = getTerritoryCenter(boundary.coordinates);

    // Create territory
    const newTerritory = {
      id: generateId(),
      name: name.trim(),
      description: description?.trim() || null,
      congregation_id: congregationId,
      boundary,
      center,
      status: 'in-stock',
      color,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: territory, error } = await supabase
      .from('territories')
      .insert(newTerritory)
      .select()
      .single();

    if (error) {
      logger.error('Error creating territory:', error);
      return NextResponse.json(
        { error: 'Failed to create territory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ territory }, { status: 201 });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
