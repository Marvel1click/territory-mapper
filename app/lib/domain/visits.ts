import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VisitOutcome } from '@/app/types';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import {
  activeDncKeyVersion,
  encryptDncValue,
  hashSensitiveLookup,
} from '@/app/lib/encryption/dnc';

interface VisitEffectInput {
  visitId: string;
  houseId: string;
  territoryId: string;
  congregationId: string;
  visitorId: string;
  outcome: VisitOutcome;
  notes?: string | null;
  visitedAt: string;
  followUpAt?: string | null;
}

/**
 * Prepares DNC ciphertext in the application server and delegates the final
 * house/DNC state transition to one database transaction. Replaying the same
 * visit is safe: an existing active DNC record is never re-encrypted from the
 * masked house value.
 */
export async function applyVisitEffects(
  sessionClient: SupabaseClient,
  input: VisitEffectInput,
): Promise<void> {
  let addressCiphertext: string | null = null;
  let notesCiphertext: string | null = null;
  let addressHash: string | null = null;
  let keyVersion: number | null = null;

  if (input.outcome === 'do-not-call') {
    const admin = createAdminClient();
    const { data: house, error: houseError } = await admin
      .from('houses')
      .select('id,address,is_dnc,deleted_at')
      .eq('id', input.houseId)
      .eq('territory_id', input.territoryId)
      .eq('congregation_id', input.congregationId)
      .maybeSingle();
    if (houseError) throw houseError;
    if (!house) throw new Error('VISIT_HOUSE_NOT_FOUND');

    if (!house.is_dnc && !house.deleted_at) {
      keyVersion = activeDncKeyVersion();
      addressCiphertext = encryptDncValue(house.address, keyVersion).ciphertext;
      notesCiphertext = input.notes
        ? encryptDncValue(input.notes, keyVersion).ciphertext
        : null;
      addressHash = hashSensitiveLookup(house.address);
    }
  }

  const { error } = await sessionClient.rpc('apply_visit_effect', {
    target_visit_id: input.visitId,
    target_address_ciphertext: addressCiphertext,
    target_notes_ciphertext: notesCiphertext,
    target_address_hash: addressHash,
    target_key_version: keyVersion,
  });
  if (error) {
    if (error.message.includes('VISIT_NOT_FOUND') || error.message.includes('VISIT_SCOPE_INVALID')) {
      throw new Error('VISIT_HOUSE_NOT_FOUND');
    }
    throw error;
  }
}
