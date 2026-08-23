import 'server-only';
import { createClient } from '@/app/lib/db/supabase/server';
import { AppError } from '@/app/lib/api/errors';
import type { Membership, UserProfile, UserRole } from '@/app/types';

interface MembershipQueryRow {
  id: string;
  user_id: string;
  congregation_id: string;
  role: UserRole;
  status: Membership['status'];
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  congregations: { id: string; name: string } | null;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

export interface AuthContext {
  userId: string;
  email: string;
  membership: Membership;
  profile: UserProfile;
}

export async function getOptionalAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data, error } = await supabase
    .from('congregation_memberships')
    .select(
      'id,user_id,congregation_id,role,status,invited_by,joined_at,created_at,updated_at,congregations(id,name),profiles!congregation_memberships_user_id_fkey(id,email,full_name,phone,created_at,updated_at)',
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as MembershipQueryRow;
  const profileRow = row.profiles;
  if (!profileRow) return null;

  return {
    userId: user.id,
    email: user.email ?? profileRow.email,
    membership: {
      id: row.id,
      user_id: row.user_id,
      congregation_id: row.congregation_id,
      role: row.role,
      status: row.status,
      invited_by: row.invited_by,
      joined_at: row.joined_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      congregation: row.congregations ?? undefined,
    },
    profile: {
      id: profileRow.id,
      email: profileRow.email,
      full_name: profileRow.full_name,
      phone: profileRow.phone ?? undefined,
      role: row.role,
      congregation_id: row.congregation_id,
      congregation: row.congregations
        ? {
            id: row.congregations.id,
            name: row.congregations.name,
            created_at: '',
            updated_at: '',
            settings: { default_map_center: [-74.006, 40.7128], default_map_zoom: 12 },
          }
        : undefined,
      created_at: profileRow.created_at,
      updated_at: profileRow.updated_at,
    },
  };
}

export async function requireAuthContext(
  roles?: readonly UserRole[],
): Promise<AuthContext> {
  const context = await getOptionalAuthContext();
  if (!context) {
    throw new AppError('AUTH_REQUIRED', 'Please sign in to continue.', 401);
  }
  if (roles && !roles.includes(context.membership.role)) {
    throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
  }
  return context;
}
