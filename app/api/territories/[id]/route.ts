/**
 * Individual Territory API Routes
 * 
 * GET /api/territories/[id] - Get a specific territory
 * PUT /api/territories/[id] - Update a territory
 * DELETE /api/territories/[id] - Delete a territory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { getTerritoryCenter } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { validateString, validateBoundary, validateColor, validateTerritoryStatus, MAX_LENGTHS } from '@/app/lib/utils/validation';
import type { Territory } from '@/app/types';

// GET /api/territories/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;

    const { data: territory, error } = await supabase
      .from('territories')
      .select('*')
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Territory not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ territory });
  } catch (error) {
    logger.error('Error fetching territory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/territories/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const role = user.user_metadata.role;
    if (role !== 'overseer' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;
    const body = await request.json();

    // Validate inputs
    if (body.name !== undefined && !validateString(body.name, MAX_LENGTHS.name)) {
      return NextResponse.json({ error: `Name must be at most ${MAX_LENGTHS.name} characters` }, { status: 400 });
    }
    if (body.description !== undefined && body.description !== null && !validateString(body.description, MAX_LENGTHS.description)) {
      return NextResponse.json({ error: `Description must be at most ${MAX_LENGTHS.description} characters` }, { status: 400 });
    }
    if (body.boundary !== undefined && !validateBoundary(body.boundary)) {
      return NextResponse.json({ error: 'Invalid boundary: must be a valid GeoJSON Polygon' }, { status: 400 });
    }
    if (body.color !== undefined && !validateColor(body.color)) {
      return NextResponse.json({ error: 'Invalid color: must be a hex color' }, { status: 400 });
    }
    if (body.status !== undefined && !validateTerritoryStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Build update object
    const updates: Partial<Territory> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.boundary !== undefined) {
      updates.boundary = body.boundary;
      updates.center = getTerritoryCenter(body.boundary.coordinates);
    }
    if (body.color !== undefined) updates.color = body.color;
    if (body.status !== undefined) updates.status = body.status;

    const { data: territory, error } = await supabase
      .from('territories')
      .update(updates)
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating territory:', error);
      return NextResponse.json(
        { error: 'Failed to update territory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ territory });
  } catch (error) {
    logger.error('Error updating territory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/territories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const role = user.user_metadata.role;
    if (role !== 'overseer' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;

    // Check if territory has active assignments
    const { data: activeAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('territory_id', id)
      .eq('status', 'active')
      .limit(1);

    if (activeAssignments && activeAssignments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete territory with active assignments' },
        { status: 400 }
      );
    }

    // Delete territory (houses will be cascade deleted via foreign key)
    const { error } = await supabase
      .from('territories')
      .delete()
      .eq('id', id)
      .eq('congregation_id', congregationId);

    if (error) {
      logger.error('Error deleting territory:', error);
      return NextResponse.json(
        { error: 'Failed to delete territory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting territory:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
