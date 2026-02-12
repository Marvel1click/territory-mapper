/**
 * Individual Assignment API Routes
 * 
 * GET /api/assignments/[id] - Get a specific assignment
 * PUT /api/assignments/[id] - Update assignment (return territory)
 * DELETE /api/assignments/[id] - Cancel/delete assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { logger } from '@/app/lib/utils/logger';
import { validateAssignmentStatus, validateISODate } from '@/app/lib/utils/validation';
import type { Assignment } from '@/app/types';

// GET /api/assignments/[id]
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
    const role = user.user_metadata.role;

    let query = supabase
      .from('assignments')
      .select(`
        *,
        territories!inner(name)
      `)
      .eq('id', id)
      .eq('congregation_id', congregationId);

    // Publishers can only see their own assignments
    if (role === 'publisher') {
      query = query.eq('publisher_id', user.id);
    }

    const { data: assignment, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Assignment not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Format with territory name
    const formattedAssignment = {
      ...assignment,
      territory_name: assignment.territories?.name || 'Unknown Territory',
      territories: undefined,
    };

    return NextResponse.json({ assignment: formattedAssignment });
  } catch (error) {
    logger.error('Error fetching assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/assignments/[id]
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
    if (body.status !== undefined && !validateAssignmentStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid assignment status' }, { status: 400 });
    }
    if (body.due_date !== undefined && body.due_date !== null && !validateISODate(body.due_date)) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    // Get current assignment
    const { data: currentAssignment } = await supabase
      .from('assignments')
      .select('territory_id, status')
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .single();

    if (!currentAssignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Partial<Assignment> & { updated_at: string; returned_at?: string } = {
      updated_at: new Date().toISOString(),
    };

    // Handle territory return
    if (body.status === 'returned') {
      updates.status = 'returned';
      updates.returned_at = new Date().toISOString();
    } else if (body.status) {
      updates.status = body.status;
    }

    if (body.due_date !== undefined) updates.due_date = body.due_date;

    const { data: assignment, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating assignment:', error);
      return NextResponse.json(
        { error: 'Failed to update assignment' },
        { status: 500 }
      );
    }

    // If returning territory, update territory status back to 'in-stock'
    if (body.status === 'returned') {
      await supabase
        .from('territories')
        .update({ 
          status: 'in-stock', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', currentAssignment.territory_id);
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    logger.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/assignments/[id]
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
    const congregationId = user.user_metadata.congregation_id;

    // Get assignment to check territory
    const { data: assignment } = await supabase
      .from('assignments')
      .select('territory_id, status, publisher_id')
      .eq('id', id)
      .eq('congregation_id', congregationId)
      .single();

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Only overseers/admins or the assigned publisher can delete
    if (role === 'publisher' && assignment.publisher_id !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // If active, return territory to stock
    if (assignment.status === 'active') {
      await supabase
        .from('territories')
        .update({ 
          status: 'in-stock', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', assignment.territory_id);
    }

    // Delete assignment
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)
      .eq('congregation_id', congregationId);

    if (error) {
      logger.error('Error deleting assignment:', error);
      return NextResponse.json(
        { error: 'Failed to delete assignment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
