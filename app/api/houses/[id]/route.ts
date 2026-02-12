/**
 * Individual House API Routes
 * 
 * GET /api/houses/[id] - Get a specific house
 * PUT /api/houses/[id] - Update a house (status, notes)
 * DELETE /api/houses/[id] - Delete a house
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { encryptDncAddress } from '@/app/lib/encryption/dnc';
import { logger } from '@/app/lib/utils/logger';
import { validateString, validateHouseStatus, validateISODate, MAX_LENGTHS } from '@/app/lib/utils/validation';
import type { House } from '@/app/types';

// GET /api/houses/[id]
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

    const { data: house, error } = await supabase
      .from('houses')
      .select('*')
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'House not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Hide DNC address details
    if (house.is_dnc) {
      house.address = 'Do Not Call';
      house.dnc_encrypted_address = undefined;
    }

    return NextResponse.json({ house });
  } catch (error) {
    logger.error('Error fetching house:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/houses/[id]
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

    const congregationId = user.user_metadata.congregation_id;
    const body = await request.json();

    // Validate inputs
    if (body.status !== undefined && !validateHouseStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid house status' }, { status: 400 });
    }
    if (body.notes !== undefined && body.notes !== null && !validateString(body.notes, MAX_LENGTHS.notes)) {
      return NextResponse.json({ error: `Notes must be at most ${MAX_LENGTHS.notes} characters` }, { status: 400 });
    }
    if (body.return_visit_date !== undefined && body.return_visit_date !== null && !validateISODate(body.return_visit_date)) {
      return NextResponse.json({ error: 'Invalid return visit date' }, { status: 400 });
    }
    if (body.last_visited !== undefined && body.last_visited !== null && !validateISODate(body.last_visited)) {
      return NextResponse.json({ error: 'Invalid last visited date' }, { status: 400 });
    }
    if (body.last_visitor !== undefined && body.last_visitor !== null && !validateString(body.last_visitor, MAX_LENGTHS.name)) {
      return NextResponse.json({ error: 'Invalid last visitor value' }, { status: 400 });
    }

    // Build update object
    const updates: Partial<House> & { updated_at: string; dnc_encrypted_address?: string } = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.is_dnc !== undefined) updates.is_dnc = body.is_dnc;
    if (body.return_visit_date !== undefined) updates.return_visit_date = body.return_visit_date;
    if (body.last_visited !== undefined) updates.last_visited = body.last_visited;
    if (body.last_visitor !== undefined) updates.last_visitor = body.last_visitor;

    // If marking as DNC, encrypt the address
    if (body.status === 'dnc' || body.is_dnc === true) {
      updates.is_dnc = true;
      
      // Get current house to encrypt its address
      const { data: currentHouse } = await supabase
        .from('houses')
        .select('address')
        .eq('id', id)
        .eq('congregation_id', congregationId)
        .single();
      
      if (currentHouse && !currentHouse.address.includes('Do Not Call')) {
        updates.dnc_encrypted_address = encryptDncAddress(currentHouse.address);
      }
    }

    const { data: house, error } = await supabase
      .from('houses')
      .update(updates)
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating house:', error);
      return NextResponse.json(
        { error: 'Failed to update house' },
        { status: 500 }
      );
    }

    // Hide DNC address in response
    if (house.is_dnc) {
      house.address = 'Do Not Call';
      house.dnc_encrypted_address = undefined;
    }

    return NextResponse.json({ house });
  } catch (error) {
    logger.error('Error updating house:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/houses/[id]
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
    // Only overseers and admins can delete houses
    if (role !== 'overseer' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const congregationId = user.user_metadata.congregation_id;

    const { error } = await supabase
      .from('houses')
      .delete()
      .eq('id', id)
      .eq('congregation_id', congregationId);

    if (error) {
      logger.error('Error deleting house:', error);
      return NextResponse.json(
        { error: 'Failed to delete house' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting house:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
