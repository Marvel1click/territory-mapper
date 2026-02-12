/**
 * Houses API Routes
 * 
 * GET /api/houses?territory_id=xxx - List houses for a territory
 * POST /api/houses - Create a new house
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/db/supabase/server';
import { generateId } from '@/app/lib/utils';
import { encryptDncAddress } from '@/app/lib/encryption/dnc';
import { logger } from '@/app/lib/utils/logger';
import { validateString, validateCoordinates, validateHouseStatus, MAX_LENGTHS } from '@/app/lib/utils/validation';
import type { House } from '@/app/types';

// GET /api/houses
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const territoryId = searchParams.get('territory_id');

    let query = supabase
      .from('houses')
      .select('*')
      .eq('congregation_id', congregationId);

    if (territoryId) {
      query = query.eq('territory_id', territoryId);
    }

    const { data: houses, error } = await query.order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching houses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch houses' },
        { status: 500 }
      );
    }

    // Decrypt DNC addresses for authorized users
    const processedHouses = houses?.map((house) => {
      if (house.is_dnc && house.dnc_encrypted_address) {
        // Only return that it's a DNC, not the actual address
        return {
          ...house,
          address: 'Do Not Call',
          dnc_encrypted_address: undefined,
        };
      }
      return house;
    });

    return NextResponse.json({ houses: processedHouses });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/houses
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
    
    if (!congregationId) {
      return NextResponse.json(
        { error: 'User not associated with a congregation' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      territory_id, 
      address, 
      coordinates, 
      status = 'not-visited',
      notes = '',
      is_dnc = false 
    } = body;

    if (!territory_id || !address || !coordinates) {
      return NextResponse.json(
        { error: 'Territory ID, address, and coordinates are required' },
        { status: 400 }
      );
    }

    if (!validateString(address, MAX_LENGTHS.address)) {
      return NextResponse.json(
        { error: `Address must be at most ${MAX_LENGTHS.address} characters` },
        { status: 400 }
      );
    }

    if (!validateCoordinates(coordinates)) {
      return NextResponse.json(
        { error: 'Invalid coordinates: must be [longitude, latitude] within valid ranges' },
        { status: 400 }
      );
    }

    if (status && !validateHouseStatus(status)) {
      return NextResponse.json(
        { error: 'Invalid house status' },
        { status: 400 }
      );
    }

    if (notes && !validateString(notes, MAX_LENGTHS.notes)) {
      return NextResponse.json(
        { error: `Notes must be at most ${MAX_LENGTHS.notes} characters` },
        { status: 400 }
      );
    }

    // Verify territory belongs to user's congregation
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

    // Prepare house data
    const newHouse: Omit<House, 'dnc_encryption_key_id' | 'last_visited' | 'last_visitor' | 'return_visit_date'> & { dnc_encrypted_address?: string } = {
      id: generateId(),
      territory_id,
      congregation_id: congregationId,
      address: address.trim(),
      coordinates,
      status,
      notes: notes?.trim() || null,
      is_dnc,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Encrypt address if DNC
    if (is_dnc) {
      newHouse.dnc_encrypted_address = encryptDncAddress(address.trim());
    }

    const { data: house, error } = await supabase
      .from('houses')
      .insert(newHouse)
      .select()
      .single();

    if (error) {
      logger.error('Error creating house:', error);
      return NextResponse.json(
        { error: 'Failed to create house' },
        { status: 500 }
      );
    }

    return NextResponse.json({ house }, { status: 201 });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
