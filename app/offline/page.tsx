'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Database, Map, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const capabilities = [
  { icon: Database, label: 'Downloaded assignment data remains available on this device.' },
  { icon: CheckCircle2, label: 'New visit outcomes queue locally until connectivity returns.' },
  { icon: Map, label: 'Only basemap tiles you viewed earlier may be available offline.' },
];

export default function OfflinePage() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <Link href="/" className="mx-auto flex w-fit items-center gap-3 text-xl font-bold">
          <Image src="/icons/icon-192x192.png" width={44} height={44} alt="" priority />
          Territory Mapper
        </Link>
        <Card className="surface-calm overflow-hidden">
          <CardHeader className="items-center bg-muted/45 py-8 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              {online ? <RefreshCw aria-hidden="true" className="size-8" /> : <WifiOff aria-hidden="true" className="size-8" />}
            </span>
            <CardTitle className="text-3xl" role="heading" aria-level={1}>Offline field mode</CardTitle>
            <CardDescription role="status" aria-live="polite">
              <span className="font-bold text-foreground">{online ? 'Connection restored. ' : 'You are offline. '}</span>
              {online ? 'Return to field mode and synchronize queued visits.' : 'Field work can continue when this assignment was downloaded after sign-in.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <ul className="space-y-3" aria-label="Offline capabilities">
              {capabilities.map(({ icon: Icon, label }) => (
                <li key={label} className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
              DNC warnings require their restricted warning feed. Do not call if a warning cannot be checked while offline.
            </p>
            <Button asChild className="w-full" size="lg">
              <Link href="/field">{online ? 'Return and sync' : 'Continue in downloaded field mode'}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
