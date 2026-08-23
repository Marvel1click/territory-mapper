import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import {
  activeDncKeyVersion,
  decryptDncValue,
  encryptDncValue,
  hashSensitiveLookup,
} from '@/app/lib/encryption/dnc';
import { upsertDncSchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

interface DncRow {
  id: string;
  house_id: string;
  territory_id: string;
  address_ciphertext: string | null;
  notes_ciphertext: string | null;
  coordinates: [number, number];
  warning_radius_m: number;
  key_version: number;
  migrated_at: string | null;
  verified_at: string | null;
  houses: { address: string; notes: string | null } | null;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const territoryId = new URL(request.url).searchParams.get('territory_id');
    if (!territoryId) {
      throw new AppError('VALIDATION_FAILED', 'A territory_id is required.', 400);
    }
    const supabase = createAdminClient();

    if (context.membership.role === 'publisher') {
      const { data: assignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('territory_id', territoryId)
        .eq('publisher_id', context.userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();
      if (!assignment) throw new AppError('FORBIDDEN', 'This territory is not assigned to you.', 403);

      const { data, error } = await supabase
        .from('dnc_records')
        .select('id,house_id,territory_id,coordinates,warning_radius_m')
        .eq('territory_id', territoryId)
        .eq('congregation_id', context.membership.congregation_id)
        .eq('active', true);
      if (error) throw error;
      const warnings = (data ?? []).map((row) => ({
        id: row.id,
        house_id: row.house_id,
        territory_id: row.territory_id,
        coordinates: row.coordinates,
        label: 'Do not call nearby' as const,
        warning_radius_m: row.warning_radius_m,
      }));
      return apiSuccess({ warnings }, requestId);
    }

    const { data, error } = await supabase
      .from('dnc_records')
      .select('id,house_id,territory_id,address_ciphertext,notes_ciphertext,coordinates,warning_radius_m,key_version,migrated_at,verified_at,houses(address,notes)')
      .eq('territory_id', territoryId)
      .eq('congregation_id', context.membership.congregation_id)
      .eq('active', true);
    if (error) throw error;
    const records = ((data ?? []) as unknown as DncRow[]).map((row) => ({
      id: row.id,
      house_id: row.house_id,
      territory_id: row.territory_id,
      address: row.address_ciphertext
        ? decryptDncValue(row.address_ciphertext)
        : row.houses?.address ?? 'Migration pending',
      notes: row.notes_ciphertext
        ? decryptDncValue(row.notes_ciphertext)
        : row.houses?.notes ?? null,
      coordinates: row.coordinates,
      warning_radius_m: row.warning_radius_m,
      key_version: row.key_version,
      migration_pending: !row.verified_at,
    }));
    return apiSuccess({ records }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'dnc-upsert');
    const input = await parseJson(request, upsertDncSchema);
    const supabase = createAdminClient();
    const { data: house, error: houseError } = await supabase
      .from('houses')
      .select('id,territory_id,congregation_id,address,notes,coordinates,is_dnc,deleted_at')
      .eq('id', input.houseId)
      .eq('congregation_id', context.membership.congregation_id)
      .maybeSingle();
    if (houseError) throw houseError;
    if (!house) throw new AppError('NOT_FOUND', 'House not found.', 404);
    if (house.is_dnc || house.deleted_at) {
      throw new AppError('CONFLICT', 'This house is already restricted.', 409);
    }

    const keyVersion = activeDncKeyVersion();
    const address = encryptDncValue(house.address, keyVersion);
    const exactNotes = input.notes ?? house.notes;
    const notes = exactNotes ? encryptDncValue(exactNotes, keyVersion) : null;
    const sessionClient = await createClient();
    const { data: dnc, error: dncError } = await sessionClient.rpc('restrict_dnc_house', {
      target_house_id: house.id,
      target_address_ciphertext: address.ciphertext,
      target_notes_ciphertext: notes?.ciphertext ?? null,
      target_address_hash: hashSensitiveLookup(house.address),
      target_key_version: keyVersion,
      target_warning_radius_m: input.warningRadiusM,
    });
    if (dncError) throw dncError;
    return apiSuccess({ dnc }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
