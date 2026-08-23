import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import { decryptDncValue } from '@/app/lib/encryption/dnc';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'dnc-remove');
    const { id } = await params;
    const supabase = createAdminClient();
    const { data: record, error } = await supabase
      .from('dnc_records')
      .select('id,house_id,address_ciphertext,notes_ciphertext')
      .eq('id', id)
      .eq('congregation_id', context.membership.congregation_id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw error;
    if (!record) throw new AppError('NOT_FOUND', 'DNC record not found.', 404);
    if (!record.address_ciphertext) {
      throw new AppError('CONFLICT', 'Complete the DNC encryption migration before removing this record.', 409);
    }

    const restoredAddress = decryptDncValue(record.address_ciphertext);
    const restoredNotes = record.notes_ciphertext
      ? decryptDncValue(record.notes_ciphertext)
      : null;
    const sessionClient = await createClient();
    const { error: restoreError } = await sessionClient.rpc('restore_dnc_house', {
      target_record_id: record.id,
      target_address: restoredAddress,
      target_notes: restoredNotes,
    });
    if (restoreError) throw restoreError;
    return apiSuccess({ removed: true }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
