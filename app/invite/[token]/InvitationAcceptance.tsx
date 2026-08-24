'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InvitePreview {
  email: string;
  role: 'admin' | 'overseer' | 'publisher';
  expiresAt: string;
  congregationName: string;
}

export function InvitationAcceptance({ token }: { token: string }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/invites/accept?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const body = await response.json() as {
          invite?: InvitePreview;
          error?: { message?: string };
        };
        if (!response.ok || !body.invite) throw new Error(body.error?.message ?? 'Invitation unavailable.');
        if (!active) return;
        setPreview(body.invite);

        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Authentication is not configured.');
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, '', window.location.pathname);
        }
        const { data } = await supabase.auth.getUser();
        if (active) setAuthenticatedEmail(data.user?.email ?? null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Invitation unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const acceptInvitation = async () => {
    if (password && password.length < 8) {
      setError('A new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Authentication is not configured.');
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
      }
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json() as {
        role?: InvitePreview['role'];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? 'Invitation could not be accepted.');
      setAccepted(true);
      const destination = body.role === 'publisher' ? '/field' : '/dashboard';
      setTimeout(() => window.location.assign(destination), 1200);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Invitation could not be accepted.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-12">
      <Card className="surface-calm w-full max-w-lg">
        <CardHeader className="text-center">
          <Image className="mx-auto mb-3" src="/icons/icon-192x192.png" alt="" width={58} height={58} priority />
          <CardTitle className="text-3xl" role="heading" aria-level={1}>Congregation invitation</CardTitle>
          <CardDescription>Confirm the details before joining the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
              <Loader2 aria-hidden="true" className="animate-spin" /> Loading invitation…
            </div>
          )}
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Invitation unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {accepted && (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Invitation accepted</AlertTitle>
              <AlertDescription>Opening your workspace…</AlertDescription>
            </Alert>
          )}
          {!loading && preview && !accepted && (
            <>
              <div className="rounded-2xl border bg-muted/50 p-5">
                <div className="flex items-start gap-3">
                  <MailCheck aria-hidden="true" className="mt-0.5 size-5 text-primary" />
                  <div className="min-w-0">
                    <p className="font-bold">{preview.congregationName}</p>
                    <p className="text-sm text-muted-foreground">For {preview.email}</p>
                    <Badge className="mt-3 capitalize" variant="secondary">{preview.role}</Badge>
                  </div>
                </div>
              </div>
              {!authenticatedEmail ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in with the invited email address, then return here to accept.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to continue</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Signed in as <strong className="text-foreground">{authenticatedEmail}</strong>.
                    New accounts can set a password now; existing accounts may leave these fields blank.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input id="new-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <Input id="confirm-password" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                    </div>
                  </div>
                  <Button className="w-full" size="lg" disabled={accepting} onClick={acceptInvitation}>
                    {accepting && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {accepting ? 'Accepting…' : 'Accept invitation'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
