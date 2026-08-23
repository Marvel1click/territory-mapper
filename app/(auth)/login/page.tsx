'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { AccessibilitySettings } from '@/app/components/accessibility/AccessibilitySettings';
import { useAuth } from '@/app/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isLoading, isAuthenticated, user, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const requestedRedirect = () => {
    const query = new URLSearchParams(window.location.search);
    const requested = query.get('redirect') ?? query.get('redirectTo');
    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;
  };

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const safeRedirect = requestedRedirect()
      ?? (user.role === 'publisher' ? '/field' : '/dashboard');
    router.replace(safeRedirect);
  }, [isAuthenticated, isLoading, router, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    try {
      await signIn(email.trim(), password);
      const redirect = requestedRedirect();
      if (redirect) router.push(redirect);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Sign-in failed.');
    }
  };

  return (
    <main id="main-content" className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(28rem,.72fr)]">
      <section className="hidden border-r bg-primary px-12 py-14 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold">
          <Image src="/icons/icon-192x192.png" alt="" width={48} height={48} priority />
          Territory Mapper
        </Link>
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-foreground/70">Field-first calm</p>
          <h2 className="mt-4 text-5xl font-bold">One clear place for every territory handoff.</h2>
          <p className="mt-5 text-lg text-primary-foreground/80">
            Continue with the account your congregation administrator invited. Your role and
            congregation access are verified by the server after sign-in.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Secure membership · Offline field mode · Accessible by design</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-5">
          <Link href="/" className="mb-7 flex items-center gap-3 text-xl font-bold lg:hidden">
            <Image src="/icons/icon-192x192.png" alt="" width={44} height={44} priority />
            Territory Mapper
          </Link>
          <Card className="surface-calm">
            <CardHeader>
              <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <LockKeyhole aria-hidden="true" />
              </span>
              <CardTitle className="text-3xl" role="heading" aria-level={1}>Welcome back</CardTitle>
              <CardDescription>Sign in with your existing or invited account.</CardDescription>
            </CardHeader>
            <CardContent>
              {(submitError || authError) && (
                <Alert variant="destructive" className="mb-5" role="alert">
                  <AlertTitle>Sign-in unsuccessful</AlertTitle>
                  <AlertDescription>{submitError || authError}</AlertDescription>
                </Alert>
              )}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="password">Password</Label>
                    <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="pr-12"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
                <Button className="w-full" type="submit" size="lg" disabled={isLoading}>
                  {isLoading && <Loader2 aria-hidden="true" className="animate-spin" />}
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <div className="mt-6 rounded-xl border bg-muted/55 p-4 text-sm text-muted-foreground">
                Need access? Territory Mapper has no public sign-up. Ask your congregation admin for an invitation.
              </div>
            </CardContent>
          </Card>
          <AccessibilitySettings />
        </div>
      </section>
    </main>
  );
}
