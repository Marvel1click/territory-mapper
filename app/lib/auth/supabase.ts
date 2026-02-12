import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import type { UserProfile, UserRole } from '@/app/types';

// Helper to get supabase client with error handling
function getClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not available. Check your environment variables.');
  }
  return client;
}

// Sign up with congregation
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  congregationId: string,
  role: UserRole = 'publisher'
) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        congregation_id: congregationId,
        role: role,
      },
    },
  });

  if (error) throw error;
  return data;
}

// Sign in
export async function signIn(email: string, password: string) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// Sign out
export async function signOut() {
  const supabase = getClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get current session
export async function getSession() {
  const supabase = getClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Get current user with profile
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = getClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return null;
  
  return {
    id: user.id,
    email: user.email!,
    full_name: user.user_metadata.full_name || '',
    role: user.user_metadata.role || 'publisher',
    congregation_id: user.user_metadata.congregation_id || '',
    phone: user.user_metadata.phone || '',
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
  };
}

// Update user profile
export async function updateProfile(updates: Partial<UserProfile>) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.updateUser({
    data: updates,
  });

  if (error) throw error;
  return data;
}

// Reset password
export async function resetPassword(email: string) {
  const supabase = getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });

  if (error) throw error;
}

// Update password
export async function updatePassword(newPassword: string) {
  const supabase = getClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

// Auth state change listener
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  const supabase = getClient();
  return supabase.auth.onAuthStateChange(callback);
}

// Check if user has required role
export function hasRole(user: UserProfile | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  
  const roleHierarchy: Record<UserRole, number> = {
    'admin': 3,
    'overseer': 2,
    'publisher': 1,
  };
  
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}
