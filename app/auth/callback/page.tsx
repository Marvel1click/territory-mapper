'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import { apiFetch } from '@/app/lib/api/client';
import type { UserProfile } from '@/app/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const providerError = query.get('error_description');
        if (providerError) throw new Error(providerError);
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Authentication is not configured.');
        const code = query.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState({}, '', window.location.pathname);
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error('This link is invalid or expired.');
        if (query.get('type') === 'recovery') { router.replace('/update-password'); return; }
        const me = await apiFetch<{ profile: UserProfile }>('/api/me');
        router.replace(me.profile.role === 'publisher' ? '/field' : '/dashboard');
      } catch (callbackError) {
        if (active) setError(callbackError instanceof Error ? callbackError.message : 'Authentication could not be completed.');
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="grid min-h-dvh place-items-center px-4"><Card className="w-full max-w-md text-center"><CardHeader><Image src="/icons/icon-192x192.png" alt="" width={56} height={56} className="mx-auto" /><CardTitle>{error ? 'Link unavailable' : 'Verifying secure link'}</CardTitle><CardDescription>Please keep this page open.</CardDescription></CardHeader><CardContent>{error ? <><Alert variant="destructive" className="text-left"><AlertTriangle aria-hidden="true" /><AlertTitle>Authentication failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert><Button className="mt-5" onClick={() => router.replace('/login')}>Return to sign in</Button></> : <div role="status" className="flex items-center justify-center gap-3 py-6 text-muted-foreground"><Loader2 aria-hidden="true" className="animate-spin text-primary" />Completing authentication…</div>}</CardContent></Card></main>;
}
