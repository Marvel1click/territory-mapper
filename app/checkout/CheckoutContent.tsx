'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole, QrCode } from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CheckoutPreview {
  territoryName: string;
  congregationName: string;
  expiresAt: string;
}

export function CheckoutContent() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('This checkout link is missing its secure token.'); setLoading(false); return; }
    let active = true;
    apiFetch<{ checkout: CheckoutPreview }>(`/api/checkout-links/redeem?token=${encodeURIComponent(token)}`)
      .then((response) => { if (active) setPreview(response.checkout); })
      .catch((loadError) => { if (active) setError(formatClientError(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const redeem = async () => {
    if (!token) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/checkout?token=${token}`)}`);
      return;
    }
    setRedeeming(true); setError(null);
    try {
      await apiFetch('/api/checkout-links/redeem', { method: 'POST', body: JSON.stringify({ token, mutationId: crypto.randomUUID() }) });
      setComplete(true);
      window.setTimeout(() => router.push('/field'), 1200);
    } catch (redeemError) { setError(formatClientError(redeemError)); }
    finally { setRedeeming(false); }
  };

  return <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-12"><Card className="w-full max-w-lg"><CardHeader className="text-center"><span className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">{complete ? <CheckCircle2 aria-hidden="true" className="size-8" /> : <QrCode aria-hidden="true" className="size-8" />}</span><CardTitle className="text-2xl" role="heading" aria-level={1}>{complete ? 'Territory checked out' : 'Secure territory checkout'}</CardTitle><CardDescription>{complete ? 'Downloading your assignment in field mode…' : 'One-time, expiring, and congregation-scoped.'}</CardDescription></CardHeader><CardContent>{loading ? <div role="status" className="flex justify-center gap-2 py-10 text-muted-foreground"><Loader2 aria-hidden="true" className="animate-spin" /> Validating link…</div> : error && !preview ? <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertTitle>Link unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : complete ? <Button className="w-full" asChild><Link href="/field">Open field mode</Link></Button> : preview ? <div className="space-y-5"><div className="rounded-2xl border bg-muted/50 p-5"><p className="text-sm font-semibold text-muted-foreground">Territory</p><p className="text-xl font-bold">{preview.territoryName}</p><p className="mt-3 text-sm font-semibold text-muted-foreground">Congregation</p><p className="font-bold">{preview.congregationName}</p><p className="mt-3 text-sm text-muted-foreground">Link expires {new Date(preview.expiresAt).toLocaleString()}</p></div>{error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}<Button className="w-full" disabled={redeeming || authLoading} onClick={() => void redeem()}>{redeeming || authLoading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LockKeyhole aria-hidden="true" />}{isAuthenticated ? 'Check out to me' : 'Sign in to continue'}</Button><p className="text-center text-xs text-muted-foreground">The token is hashed at rest and becomes unusable after checkout.</p></div> : null}</CardContent></Card></main>;
}
