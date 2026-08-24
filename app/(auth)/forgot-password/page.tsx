'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { resetPassword } from '@/app/lib/auth/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError('We could not request a recovery link. Check your connection and try again.');
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
            <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><MailCheck aria-hidden="true" /></span>
            <CardTitle className="text-3xl" role="heading" aria-level={1}>Recover your password</CardTitle>
            <CardDescription>We will email recovery instructions if the address belongs to an existing account.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <Alert variant="destructive" role="alert" className="mb-5"><AlertTitle>Request unsuccessful</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            {sent ? <Alert className="mb-5"><MailCheck aria-hidden="true" /><AlertTitle>Check your inbox</AlertTitle><AlertDescription>If the account exists, its recovery instructions are on the way.</AlertDescription></Alert> : null}
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="recovery-email">Email address</Label>
                <Input id="recovery-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <Button className="w-full" size="lg" type="submit" disabled={loading}>
                {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <MailCheck aria-hidden="true" />}
                {loading ? 'Requesting…' : 'Send recovery link'}
              </Button>
            </form>
            <Button asChild variant="ghost" className="mt-4 w-full"><Link href="/login"><ArrowLeft aria-hidden="true" /> Back to sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
