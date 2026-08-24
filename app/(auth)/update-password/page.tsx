'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { updatePassword } from '@/app/lib/auth/supabase';
import { getSupabaseClient } from '@/app/lib/db/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    const checkRecoverySession = async () => {
      const client = getSupabaseClient();
      if (!client) {
        if (active) setError('Authentication service is not configured.');
        return;
      }
      const { data } = await client.auth.getSession();
      if (active && !data.session) setLinkExpired(true);
    };
    void checkRecoverySession();
    return () => { active = false; };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      setUpdated(true);
      window.setTimeout(() => router.replace('/login'), 1500);
    } catch {
      setError('The password could not be updated. Request a fresh recovery link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <Link href="/" className="mx-auto flex w-fit items-center gap-3 text-xl font-bold">
          <Image src="/icons/icon-192x192.png" width={44} height={44} alt="" priority />
          Territory Mapper
        </Link>
        <Card className="surface-calm">
          <CardHeader>
            <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><LockKeyhole aria-hidden="true" /></span>
            <CardTitle className="text-3xl" role="heading" aria-level={1}>Choose a new password</CardTitle>
            <CardDescription>Use a unique passphrase with at least 12 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <Alert variant="destructive" role="alert" className="mb-5"><AlertTitle>Update unsuccessful</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            {updated ? <Alert className="mb-5"><CheckCircle2 aria-hidden="true" /><AlertTitle>Password updated</AlertTitle><AlertDescription>Returning to sign in…</AlertDescription></Alert> : null}
            {linkExpired ? (
              <div className="space-y-4">
                <p className="rounded-xl border bg-muted/55 p-4 text-sm">This recovery link has expired or was already used.</p>
                <Button asChild className="w-full"><Link href="/forgot-password">Request a new recovery link</Link></Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input id="new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" aria-describedby="password-help" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={visible ? 'Hide passwords' : 'Show passwords'} onClick={() => setVisible((value) => !value)}>
                      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  </div>
                  <p id="password-help" className="text-xs text-muted-foreground">At least 12 characters; a memorable multi-word passphrase works well.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={loading || updated}>
                  {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LockKeyhole aria-hidden="true" />}
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
