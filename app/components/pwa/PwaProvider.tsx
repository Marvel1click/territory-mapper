'use client';

import { useEffect, useRef, useState } from 'react';
import { SerwistProvider, useSerwist } from '@serwist/turbopack/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function PwaPrompts() {
  const { serwist } = useSerwist();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setUpdateAvailable(true);
    const onControlling = () => {
      if (updateRequested.current) window.location.reload();
    };
    serwist.addEventListener('waiting', onWaiting);
    serwist.addEventListener('controlling', onControlling);
    return () => {
      serwist.removeEventListener('waiting', onWaiting);
      serwist.removeEventListener('controlling', onControlling);
    };
  }, [serwist]);

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  if (dismissed || !updateAvailable && !installPrompt) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 z-[100] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl md:bottom-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {updateAvailable ? <RefreshCw aria-hidden="true" className="size-5" /> : <Download aria-hidden="true" className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{updateAvailable ? 'Update ready' : 'Install Territory Mapper'}</p>
        <p className="text-sm text-muted-foreground">
          {updateAvailable ? 'Refresh when you are ready.' : 'Keep field mode close at hand.'}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          if (updateAvailable) {
            updateRequested.current = true;
            serwist?.messageSkipWaiting();
          } else if (installPrompt) {
            void installPrompt.prompt();
            setInstallPrompt(null);
          }
        }}
      >
        {updateAvailable ? 'Update' : 'Install'}
      </Button>
      <Button
        aria-label="Dismiss"
        size="icon-sm"
        variant="ghost"
        onClick={() => setDismissed(true)}
      >
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== 'production'}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      {children}
      <PwaPrompts />
    </SerwistProvider>
  );
}
