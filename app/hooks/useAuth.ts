'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/app/types';
import { logger } from '@/app/lib/utils/logger';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    
    // If Supabase client is not available, skip auth initialization
    if (!supabase) {
      console.warn('Supabase client not available. Auth functionality disabled.');
      setIsLoading(false);
      setError('Authentication service not configured');
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.error('Session error:', sessionError);
          setError(sessionError.message);
        } else if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata.full_name || '',
            role: session.user.user_metadata.role || 'publisher',
            congregation_id: session.user.user_metadata.congregation_id || '',
            phone: session.user.user_metadata.phone || '',
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          });
          setIsAuthenticated(true);
        }
      } catch (err) {
        logger.error('Auth initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown auth error');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata.full_name || '',
          role: session.user.user_metadata.role || 'publisher',
          congregation_id: session.user.user_metadata.congregation_id || '',
          phone: session.user.user_metadata.phone || '',
          created_at: session.user.created_at,
          updated_at: session.user.updated_at || session.user.created_at,
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service not configured');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata: Record<string, unknown>) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service not configured');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;
      
      // onAuthStateChange listener will update the state automatically
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign up';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service not configured');
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signUp,
    signOut,
  };
}
