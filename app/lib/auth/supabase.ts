import { getSupabaseClient } from '@/app/lib/db/supabase/client';

function getClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Authentication service is not configured.');
  return client;
}

export async function resetPassword(email: string) {
  const supabase = getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const supabase = getClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
