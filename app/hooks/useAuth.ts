'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import type { UserProfile } from '@/app/types';
import { logger } from '@/app/lib/utils/logger';

interface MeResponse {
  profile: UserProfile;
}

async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch('/api/me', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'Your membership could not be loaded.',
    );
  }
  const body = (await response.json()) as MeResponse;
  return body.profile;
}

async function clearUserCaches(): Promise<void> {
  const [{ resetDatabase }, { resetReplicationStatus }, { useSyncStore }] = await Promise.all([
    import('@/app/lib/db/rxdb'),
    import('@/app/lib/db/replication/supabase'),
    import('@/app/lib/store'),
  ]);
  await resetDatabase();
  resetReplicationStatus();
  useSyncStore.getState().resetSyncState();
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('territory-mapper-user-'))
        .map((key) => caches.delete(key)),
    );
  }
}

function useAuthController() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    const profile = await fetchProfile();
    setUser(profile);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication service is not configured.');
      setIsLoading(false);
      return;
    }

    let active = true;
    const initialize = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (active) await refreshProfile(session);
      } catch (authError) {
        logger.error('Auth initialization failed', authError);
        if (active) setError(authError instanceof Error ? authError.message : 'Sign-in failed.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        void (async () => {
          try {
            await refreshProfile(session);
            setError(null);
          } catch (authError) {
            logger.error('Membership refresh failed', authError);
            setUser(null);
            setError(authError instanceof Error ? authError.message : 'Membership unavailable.');
          } finally {
            setIsLoading(false);
          }
        })();
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Authentication service is not configured.');
    setIsLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Authentication service is not configured.');
    setIsLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setIsLoading(false);
      throw signOutError;
    }
    await clearUserCaches();
    setUser(null);
    setIsLoading(false);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    error,
    signIn,
    signOut,
  };
}

type AuthContextValue = ReturnType<typeof useAuthController>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuthController();
  return createElement(AuthContext.Provider, { value: auth }, children);
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return auth;
}
