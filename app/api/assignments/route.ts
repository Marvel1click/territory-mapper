/**
 * Assignments API Routes
 * 
 * GET /api/assignments - List assignments for user's congregation
 * POST /api/assignments - Create a new assignment (checkout)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { generateId } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { validateString, validateISODate, MAX_LENGTHS } from '@/app/lib/utils/validation';

interface AssignmentWithTerritory {
  id: string;
  territory_id: string;
  publisher_id: string;
  publisher_name: string;
  congregation_id: string;
  checked_out_at: string;
  checked_out_by: string;
  due_date?: string;
  returned_at?: string;
  status: 'active' | 'returned' | 'overdue';
  qr_token?: string;
  created_at: string;
  updated_at: string;
  territories?: { name: string };
}

// GET /api/assignments
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
    const role = user.user_metadata.role;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const territoryId = searchParams.get('territory_id');
    const publisherId = searchParams.get('publisher_id');

    let query = supabase
      .from('assignments')
      .select(`
        *,
        territories!inner(name)
      `)
      .eq('congregation_id', congregationId);

    // Publishers can only see their own assignments
    if (role === 'publisher') {
      query = query.eq('publisher_id', user.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (territoryId) {
      query = query.eq('territory_id', territoryId);
    }

    if (publisherId && role !== 'publisher') {
      query = query.eq('publisher_id', publisherId);
    }

    const { data: assignments, error } = await query
      .order('checked_out_at', { ascending: false });

    if (error) {
      logger.error('Error fetching assignments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      );
    }

    // Format assignments with territory names
    const formattedAssignments = assignments?.map((a: AssignmentWithTerritory) => ({
      ...a,
      territory_name: a.territories?.name || 'Unknown Territory',
      territories: undefined,
    }));

    return NextResponse.json({ assignments: formattedAssignments });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/assignments
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
      territory_id, 
      publisher_id, 
      publisher_name,
      due_date,
      qr_token 
    } = body;

    if (!territory_id || !publisher_id || !publisher_name) {
      return NextResponse.json(
        { error: 'Territory ID, publisher ID, and publisher name are required' },
        { status: 400 }
      );
    }

    if (!validateString(publisher_name, MAX_LENGTHS.publisherName)) {
      return NextResponse.json(
        { error: `Publisher name must be at most ${MAX_LENGTHS.publisherName} characters` },
        { status: 400 }
      );
    }

    if (due_date !== undefined && due_date !== null && !validateISODate(due_date)) {
      return NextResponse.json(
        { error: 'Invalid due date' },
        { status: 400 }
      );
    }

    if (qr_token !== undefined && qr_token !== null && !validateString(qr_token, MAX_LENGTHS.qrToken)) {
      return NextResponse.json(
        { error: 'Invalid QR token' },
        { status: 400 }
      );
    }

    // Check if territory is already assigned
    const { data: existingAssignment } = await supabase
      .from('assignments')
      .select('id')
      .eq('territory_id', territory_id)
      .eq('status', 'active')
      .limit(1);

    if (existingAssignment && existingAssignment.length > 0) {
      return NextResponse.json(
        { error: 'Territory is already checked out' },
        { status: 409 }
      );
    }

    // Verify territory belongs to congregation
    const { data: territory } = await supabase
      .from('territories')
      .select('id')
      .eq('id', territory_id)
      .eq('congregation_id', congregationId)
      .single();

    if (!territory) {
      return NextResponse.json(
        { error: 'Territory not found or access denied' },
        { status: 404 }
      );
    }

    // Start a transaction to create assignment and update territory status
    const newAssignment = {
      id: generateId(),
      territory_id,
      publisher_id,
      publisher_name: publisher_name.trim(),
      congregation_id: congregationId,
      checked_out_at: new Date().toISOString(),
      checked_out_by: user.id,
      due_date: due_date || null,
      status: 'active',
      qr_token: qr_token || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: assignment, error } = await supabase
      .from('assignments')
      .insert(newAssignment)
      .select()
      .single();

    if (error) {
      logger.error('Error creating assignment:', error);
      return NextResponse.json(
        { error: 'Failed to create assignment' },
        { status: 500 }
      );
    }

    // Update territory status to 'out'
    await supabase
      .from('territories')
      .update({ status: 'out', updated_at: new Date().toISOString() })
      .eq('id', territory_id);

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
