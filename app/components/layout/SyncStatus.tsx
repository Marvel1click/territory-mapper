'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Database, Loader2, Map, RefreshCw, TriangleAlert, WifiOff, X } from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { useSync } from '@/app/hooks/useRxDB';
import { useSyncStore } from '@/app/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function SyncStatus() {
  const { user } = useAuth();
  const { sync } = useSync(user?.congregation_id);
  const {
    isOnline,
    isSyncing,
    lastSync,
    pendingChanges,
    syncError,
    offlineDataReady,
    basemapReady,
    setOnline,
    setBasemapReady,
  } = useSyncStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const online = () => setOnline(true);
    const offline = () => setOnline(false);
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [setOnline]);

  useEffect(() => {
    if (!open || !('caches' in window)) return;
    let active = true;
    void (async () => {
      const names = (await caches.keys()).filter((name) => name.includes('basemap'));
      const cachedRequests = await Promise.all(
        names.map(async (name) => (await caches.open(name)).keys()),
      );
      if (active) setBasemapReady(cachedRequests.some((requests) => requests.length > 0));
    })();
    return () => { active = false; };
  }, [open, setBasemapReady]);

  const label = !isOnline ? 'Offline' : syncError ? 'Sync issue' : pendingChanges ? `${pendingChanges} queued` : isSyncing ? 'Syncing' : 'Synced';
  const Icon = !isOnline ? WifiOff : syncError ? TriangleAlert : isSyncing ? Loader2 : CheckCircle2;

  return <div className="relative"><Button variant="outline" size="sm" aria-expanded={open} aria-controls="sync-details" onClick={() => setOpen((value) => !value)}><Icon aria-hidden="true" className={isSyncing ? 'animate-spin' : ''} /><span className="hidden sm:inline">{label}</span></Button>{open ? <section id="sync-details" aria-label="Offline and synchronization status" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-card p-4 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Field readiness</h2><Button size="icon-sm" variant="ghost" aria-label="Close sync status" onClick={() => setOpen(false)}><X aria-hidden="true" /></Button></div><dl className="space-y-3 text-sm"><StatusRow icon={isOnline ? Cloud : WifiOff} term="Connection" value={isOnline ? 'Online' : 'Offline'} ready={isOnline} /><StatusRow icon={Database} term="Offline assignment data" value={offlineDataReady ? 'Ready on this device' : 'Preparing after sign-in'} ready={offlineDataReady} /><StatusRow icon={Map} term="Basemap coverage" value={basemapReady ? 'Previously viewed tiles detected' : 'No viewed tiles confirmed'} ready={basemapReady} /><StatusRow icon={RefreshCw} term="Queued edits" value={`${pendingChanges} waiting`} ready={pendingChanges === 0} /></dl>{syncError ? <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{syncError}</p> : null}<p className="mt-4 text-xs text-muted-foreground">Last successful sync: {lastSync ? new Date(lastSync).toLocaleString() : 'Not yet on this device'}</p><Button className="mt-4 w-full" size="sm" disabled={!isOnline || isSyncing} onClick={() => void sync()}>{isSyncing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />} Sync now</Button></section> : null}</div>;
}

function StatusRow({ icon: Icon, term, value, ready }: { icon: typeof Cloud; term: string; value: string; ready: boolean }) {
  return <div className="flex items-start gap-3"><Icon aria-hidden="true" className={ready ? 'mt-0.5 size-5 text-primary' : 'mt-0.5 size-5 text-amber-700 dark:text-amber-300'} /><div className="min-w-0 flex-1"><dt className="font-bold">{term}</dt><dd className="text-muted-foreground">{value}</dd></div><Badge variant="outline">{ready ? 'Ready' : 'Limited'}</Badge></div>;
}
