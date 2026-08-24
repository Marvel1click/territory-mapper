import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { activeDncKeyVersion, encryptDncValue, hashSensitiveLookup } from '@/app/lib/encryption/dnc';
import { generateId } from '@/app/lib/utils';
import { importHousesSchema } from '@/app/lib/validation/schemas';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const insertedIds: string[] = [];
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'house-import', { limit: 5, windowMs: 60_000 });
    const input = await parseJson(request, importHousesSchema);
    const admin = createAdminClient();
    const { data: territory, error: territoryError } = await admin
      .from('territories')
      .select('id')
      .eq('id', input.territoryId)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (territoryError) throw territoryError;
    if (!territory) throw new AppError('NOT_FOUND', 'Territory not found.', 404);

    const normalized = input.rows.map((row) => ({
      ...row,
      addressKey: row.address.toLocaleLowerCase().replaceAll(/\s+/g, ' ').trim(),
    }));
    const duplicates = normalized.filter((row, index) => normalized.findIndex((candidate) => candidate.addressKey === row.addressKey) !== index);
    if (duplicates.length) {
      throw new AppError('VALIDATION_FAILED', `Duplicate address in CSV near row ${duplicates[0].row}.`, 400);
    }

    const houses = normalized.map((row) => {
      const id = generateId();
      insertedIds.push(id);
      return {
        id,
        territory_id: input.territoryId,
        congregation_id: context.membership.congregation_id,
        address: row.isDnc ? 'DNC address restricted' : row.address,
        coordinates: [row.longitude, row.latitude],
        status: row.isDnc ? 'dnc' : 'not-visited',
        notes: row.isDnc ? null : row.notes ?? null,
        is_dnc: row.isDnc,
        deleted_at: row.isDnc ? new Date().toISOString() : null,
        last_mutation_id: crypto.randomUUID(),
      };
    });
    const { error: insertError } = await admin.from('houses').insert(houses);
    if (insertError) throw insertError;

    const dncRows = normalized.flatMap((row, index) => {
      if (!row.isDnc) return [];
      const keyVersion = activeDncKeyVersion();
      return [{
        house_id: houses[index].id,
        territory_id: input.territoryId,
        congregation_id: context.membership.congregation_id,
        address_ciphertext: encryptDncValue(row.address, keyVersion).ciphertext,
        notes_ciphertext: row.notes ? encryptDncValue(row.notes, keyVersion).ciphertext : null,
        address_hash: hashSensitiveLookup(row.address),
        key_version: keyVersion,
        coordinates: [row.longitude, row.latitude],
        warning_radius_m: 35,
        active: true,
        migrated_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        created_by: context.userId,
      }];
    });
    if (dncRows.length) {
      const { error: dncError } = await admin.from('dnc_records').insert(dncRows);
      if (dncError) throw dncError;
    }

    return apiSuccess({ imported: houses.length, dnc: dncRows.length }, requestId, { status: 201 });
  } catch (error) {
    if (insertedIds.length) {
      const admin = createAdminClient();
      await admin.from('dnc_records').delete().in('house_id', insertedIds);
      await admin.from('houses').delete().in('id', insertedIds);
    }
    return apiErrorResponse(toAppError(error), requestId);
  }
}
