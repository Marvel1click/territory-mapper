import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createOpaqueToken, hashOpaqueToken } from '@/app/lib/encryption/dnc';
import { createCheckoutLinkSchema } from '@/app/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext(['admin', 'overseer']);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('checkout_links')
      .select('id,territory_id,expires_at,used_at,revoked_at,created_by,created_at,territories(name)')
      .eq('congregation_id', context.membership.congregation_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return apiSuccess({ checkoutLinks: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'checkout-link-create');
    const input = await parseJson(request, createCheckoutLinkSchema);
    const supabase = createAdminClient();
    const { data: territory, error: territoryError } = await supabase
      .from('territories')
      .select('id,name,status')
      .eq('id', input.territoryId)
      .eq('congregation_id', context.membership.congregation_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (territoryError) throw territoryError;
    if (!territory) throw new AppError('NOT_FOUND', 'Territory not found.', 404);
    if (territory.status === 'out') {
      throw new AppError('CONFLICT', 'This territory is already checked out.', 409);
    }

    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString();
    const { data: link, error } = await supabase
      .from('checkout_links')
      .insert({
        territory_id: territory.id,
        congregation_id: context.membership.congregation_id,
        token_hash: hashOpaqueToken(token),
        expires_at: expiresAt,
        created_by: context.userId,
      })
      .select('id,territory_id,expires_at,created_at')
      .single();
    if (error) throw error;

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    return apiSuccess(
      {
        checkoutLink: {
          ...link,
          url: `${appOrigin}/checkout?token=${encodeURIComponent(token)}`,
          territoryName: territory.name,
        },
      },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
