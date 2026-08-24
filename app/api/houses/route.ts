import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import {
  activeDncKeyVersion,
  encryptDncValue,
  hashSensitiveLookup,
} from '@/app/lib/encryption/dnc';
import { generateId } from '@/app/lib/utils';
import { createHouseSchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext();
    const territoryId = new URL(request.url).searchParams.get('territory_id');
    const supabase = await createClient();
    let query = supabase
      .from('houses')
      .select('id,territory_id,congregation_id,address,coordinates,status,notes,is_dnc,last_visited,last_visitor,return_visit_date,created_at,updated_at,version,server_updated_at,deleted_at')
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null);
    if (territoryId) query = query.eq('territory_id', territoryId);
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return apiSuccess({ houses: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'house-create');
    const input = await parseJson(request, createHouseSchema);
    const supabase = await createClient();
    const { data: territory } = await supabase
      .from('territories')
      .select('id')
      .eq('id', input.territory_id)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!territory) throw new AppError('NOT_FOUND', 'Territory not found.', 404);

    const houseId = generateId();
    const restrictionTime = input.is_dnc ? new Date().toISOString() : null;
    const { data: house, error } = await supabase
      .from('houses')
      .insert({
        id: houseId,
        territory_id: input.territory_id,
        congregation_id: context.membership.congregation_id,
        address: input.is_dnc ? 'DNC address restricted' : input.address,
        coordinates: input.coordinates,
        status: input.is_dnc ? 'dnc' : input.status,
        notes: input.is_dnc ? null : input.notes ?? null,
        is_dnc: input.is_dnc,
        deleted_at: restrictionTime,
        last_mutation_id: crypto.randomUUID(),
      })
      .select('*')
      .single();
    if (error) throw error;

    if (input.is_dnc) {
      const admin = createAdminClient();
      const keyVersion = activeDncKeyVersion();
      const encryptedAddress = encryptDncValue(input.address, keyVersion);
      const encryptedNotes = input.notes ? encryptDncValue(input.notes, keyVersion) : null;
      const now = new Date().toISOString();
      const { error: dncError } = await admin.from('dnc_records').insert({
        house_id: houseId,
        territory_id: input.territory_id,
        congregation_id: context.membership.congregation_id,
        address_ciphertext: encryptedAddress.ciphertext,
        notes_ciphertext: encryptedNotes?.ciphertext ?? null,
        address_hash: hashSensitiveLookup(input.address),
        key_version: keyVersion,
        coordinates: input.coordinates,
        warning_radius_m: 35,
        active: true,
        migrated_at: now,
        verified_at: now,
        created_by: context.userId,
      });
      if (dncError) {
        await admin.from('houses').delete().eq('id', houseId);
        throw dncError;
      }
    }

    delete house.dnc_encrypted_address;
    return apiSuccess({ house }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
