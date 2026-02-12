import { createBrowserClient } from '@supabase/ssr';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only create client if environment variables are available
// This prevents errors during SSR/build when env vars might not be set
function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables are not set. Authentication will not work.');
    // Return a mock client that will fail gracefully
    return null;
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function createClient() {
  const client = createSupabaseClient();
  if (!client) {
    throw new Error('Supabase client could not be created. Check your environment variables.');
  }
  return client;
}

// Create singleton instance with lazy initialization
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

// For backward compatibility - but this will be null if env vars aren't set
export const supabase = getSupabaseClient();
