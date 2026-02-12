'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import { Loader2, MapPin } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Processing...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = getSupabaseClient();
        
        if (!supabase) {
          setError('Authentication service not configured. Please contact support.');
          return;
        }

        // Get query parameters from URL
        const query = new URLSearchParams(window.location.search);
        const type = query.get('type');

        // Check for error in URL
        const errorDescription = query.get('error_description');
        if (errorDescription) {
          setError(errorDescription);
          return;
        }

        // Handle password recovery
        if (type === 'recovery') {
          setMessage('Verifying reset link...');
          
          // The session should already be set by Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            setError('Invalid or expired reset link. Please try again.');
            return;
          }

          // Redirect to update password page
          router.push('/update-password');
          return;
        }

        // Handle email confirmation
        if (type === 'signup' || type === 'email_change') {
          setMessage('Confirming your email...');
          
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            setError('Failed to confirm email. Please try again.');
            return;
          }

          if (session) {
            setMessage('Email confirmed! Redirecting...');
            router.push('/');
          } else {
            setMessage('Email confirmed! Please sign in.');
            setTimeout(() => router.push('/login'), 2000);
          }
          return;
        }

        // Default: check session and redirect
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          router.push('/');
        } else {
          router.push('/login');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 font-bold text-xl">
            <MapPin className="w-6 h-6 text-primary" />
            <span>Territory Mapper</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {error ? (
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                {error}
              </div>
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
