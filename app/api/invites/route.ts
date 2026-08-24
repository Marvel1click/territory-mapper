import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createOpaqueToken, hashOpaqueToken } from '@/app/lib/encryption/dnc';
import { createInviteSchema } from '@/app/lib/validation/schemas';
import { logger } from '@/app/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const context = await requireAuthContext(['admin']);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('congregation_invites')
      .select('id,congregation_id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at')
      .eq('congregation_id', context.membership.congregation_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return apiSuccess({ invites: data ?? [] }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin']);
    throttleMutation(context.userId, 'invite-create');
    const input = await parseJson(request, createInviteSchema);
    const supabase = createAdminClient();

    const { data: existingInvite } = await supabase
      .from('congregation_invites')
      .select('id')
      .eq('congregation_id', context.membership.congregation_id)
      .eq('email', input.email)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (existingInvite) {
      throw new AppError('CONFLICT', 'An active invitation already exists for this email.', 409);
    }

    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invite, error: insertError } = await supabase
      .from('congregation_invites')
      .insert({
        congregation_id: context.membership.congregation_id,
        email: input.email,
        role: input.role,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: context.userId,
      })
      .select('id,email,role,expires_at,created_at')
      .single();
    if (insertError) throw insertError;

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const acceptUrl = `${appOrigin}/invite/${encodeURIComponent(token)}`;
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: acceptUrl,
      data: { invitation_id: invite.id },
    });

    let delivery: 'sent' | 'sign-in-link-sent' | 'manual' = 'sent';
    if (inviteError) {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: { emailRedirectTo: acceptUrl, shouldCreateUser: false },
      });
      delivery = otpError ? 'manual' : 'sign-in-link-sent';
      if (otpError) {
        logger.warn('Invite stored but email delivery requires manual copy', {
          requestId,
          invitationId: invite.id,
          reason: otpError.code ?? 'delivery_failed',
        });
      }
    }

    return apiSuccess(
      { invite, delivery, acceptUrl },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
