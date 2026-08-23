'use client';

import { useState } from 'react';
import { Database, Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { AccessibilitySettings } from '@/app/components/accessibility/AccessibilitySettings';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useAuth } from '@/app/hooks/useAuth';
import { resetDatabase } from '@/app/lib/db/rxdb';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WorkspaceSettings() {
  const { user, signOut } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const clearOffline = async () => {
    setClearing(true);
    try {
      await resetDatabase();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.includes('mapbox') || key.startsWith('territory-mapper-user-')).map((key) => caches.delete(key)));
      }
      setCleared(true);
    } finally { setClearing(false); }
  };

  return <div className="space-y-7"><PageHeader eyebrow="Settings" title="A calmer field experience, tuned to you." description="Accessibility preferences are device-local. Membership and role are controlled by congregation administrators." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><AccessibilitySettings /><div className="space-y-6"><Card><CardHeader><CardTitle>Account & access</CardTitle><CardDescription>Server-authoritative identity</CardDescription></CardHeader><CardContent className="space-y-4"><div><p className="font-bold">{user?.full_name || user?.email}</p><p className="text-sm text-muted-foreground">{user?.email}</p></div><div className="flex flex-wrap gap-2"><Badge><ShieldCheck aria-hidden="true" /> {user?.role}</Badge><Badge variant="outline">{user?.congregation?.name}</Badge></div><Button variant="outline" className="w-full" onClick={() => void signOut()}><LogOut aria-hidden="true" /> Sign out</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Offline storage</CardTitle><CardDescription>Assignment records and previously viewed basemap tiles are stored only on this device.</CardDescription></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground"><Database aria-hidden="true" className="mr-2 inline size-4" />Exact DNC addresses and authentication responses are never stored in publisher IndexedDB or PWA caches.</p>{cleared ? <p role="status" className="mb-3 text-sm font-bold text-primary">Offline data cleared.</p> : null}<AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="w-full"><Trash2 aria-hidden="true" /> Clear offline data</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear this device&apos;s offline data?</AlertDialogTitle><AlertDialogDescription>Queued visits that have not synchronized may be lost. Use the sync status before continuing.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={clearing} onClick={() => void clearOffline()}>{clearing ? <Loader2 aria-hidden="true" className="animate-spin" /> : null} Clear device data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card></div></div>
  </div>;
}
