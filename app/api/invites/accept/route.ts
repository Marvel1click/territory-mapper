import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { createAdminClient } from '@/app/lib/db/supabase/admin';
import { createClient } from '@/app/lib/db/supabase/server';
import { hashOpaqueToken } from '@/app/lib/encryption/dnc';
import { acceptInviteSchema, opaqueTokenSchema } from '@/app/lib/validation/schemas';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const token = opaqueTokenSchema.parse(new URL(request.url).searchParams.get('token'));
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('congregation_invites')
      .select('id,email,role,expires_at,accepted_at,revoked_at,congregations(name)')
      .eq('token_hash', hashOpaqueToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('NOT_FOUND', 'Invitation not found.', 404);
    if (data.revoked_at) throw new AppError('INVITE_REVOKED', 'This invitation was revoked.', 410);
    if (data.accepted_at) throw new AppError('CONFLICT', 'This invitation was already accepted.', 409);
    if (new Date(data.expires_at) <= new Date()) {
      throw new AppError('INVITE_EXPIRED', 'This invitation has expired.', 410);
    }
    const congregation = data.congregations as unknown as { name: string } | null;
    return apiSuccess(
      {
        invite: {
          email: maskEmail(data.email),
          role: data.role,
          expiresAt: data.expires_at,
          congregationName: congregation?.name ?? 'Your congregation',
        },
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return apiErrorResponse(new AppError('NOT_FOUND', 'Invitation not found.', 404), requestId);
    }
    return apiErrorResponse(toAppError(error), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, acceptInviteSchema);
    const sessionClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();
    if (userError || !user || !user.email) {
      throw new AppError('AUTH_REQUIRED', 'Sign in with the invited email to continue.', 401);
    }
    throttleMutation(user.id, 'invite-accept');

    const supabase = createAdminClient();
    const { data: invite, error: inviteError } = await supabase
      .from('congregation_invites')
      .select('*')
      .eq('token_hash', hashOpaqueToken(input.token))
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) throw new AppError('NOT_FOUND', 'Invitation not found.', 404);
    if (invite.revoked_at) throw new AppError('INVITE_REVOKED', 'This invitation was revoked.', 410);
    if (invite.accepted_at) throw new AppError('CONFLICT', 'This invitation was already accepted.', 409);
    if (new Date(invite.expires_at) <= new Date()) {
      throw new AppError('INVITE_EXPIRED', 'This invitation has expired.', 410);
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('FORBIDDEN', 'Sign in with the email address that received this invitation.', 403);
    }

    const { data: accepted, error: acceptError } = await sessionClient.rpc(
      'accept_congregation_invite',
      { target_invite_id: invite.id },
    );
    if (acceptError) {
      if (acceptError.message.includes('INVITE_REVOKED')) throw new AppError('INVITE_REVOKED', 'This invitation was revoked.', 410);
      if (acceptError.message.includes('INVITE_EXPIRED')) throw new AppError('INVITE_EXPIRED', 'This invitation has expired.', 410);
      if (acceptError.message.includes('INVITE_EMAIL_MISMATCH')) throw new AppError('FORBIDDEN', 'Sign in with the email address that received this invitation.', 403);
      if (acceptError.message.includes('ACTIVE_MEMBERSHIP_EXISTS')) throw new AppError('CONFLICT', 'This account already belongs to another congregation.', 409);
      if (acceptError.message.includes('INVITE_ACCEPTED')) throw new AppError('CONFLICT', 'This invitation was already accepted.', 409);
      throw acceptError;
    }

    const result = accepted as { accepted: boolean; role: string } | null;
    return apiSuccess({ accepted: true, role: result?.role ?? invite.role }, requestId);
  } catch (error) {
    return apiErrorResponse(toAppError(error), requestId);
  }
}
