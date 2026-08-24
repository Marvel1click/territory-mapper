import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import { hashOpaqueToken } from '@/app/lib/encryption/dnc';
import { opaqueTokenSchema, redeemCheckoutSchema } from '@/app/lib/validation/schemas';

function checkoutError(message?: string): AppError {
  if (message?.includes('CHECKOUT_TOKEN_EXPIRED')) {
    return new AppError('CHECKOUT_TOKEN_EXPIRED', 'This checkout link has expired.', 410);
  }
  if (message?.includes('TERRITORY_ALREADY_ASSIGNED')) {
    return new AppError('CONFLICT', 'This territory was checked out by someone else.', 409);
  }
  if (message?.includes('FORBIDDEN')) {
    return new AppError('FORBIDDEN', 'This link belongs to another congregation.', 403);
  }
  return new AppError('CHECKOUT_TOKEN_INVALID', 'This checkout link is invalid or was already used.', 410);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const token = opaqueTokenSchema.parse(new URL(request.url).searchParams.get('token'));
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('checkout_links')
      .select('expires_at,used_at,revoked_at,territories(name),congregations(name)')
      .eq('token_hash', hashOpaqueToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data || data.used_at || data.revoked_at) throw checkoutError();
    if (new Date(data.expires_at) <= new Date()) throw checkoutError('CHECKOUT_TOKEN_EXPIRED');
    const territory = data.territories as unknown as { name: string } | null;
    const congregation = data.congregations as unknown as { name: string } | null;
    return apiSuccess(
      {
        checkout: {
          territoryName: territory?.name ?? 'Territory',
          congregationName: congregation?.name ?? 'Congregation',
          expiresAt: data.expires_at,
        },
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return apiErrorResponse(checkoutError(), requestId);
    }
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext();
    throttleMutation(context.userId, 'checkout-redeem');
    const input = await parseJson(request, redeemCheckoutSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('redeem_checkout_link', {
      target_token_hash: hashOpaqueToken(input.token),
      target_mutation_id: input.mutationId,
    });
    if (error) throw checkoutError(error.message);
    return apiSuccess({ assignment: data }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
