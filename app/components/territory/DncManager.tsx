'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LockKeyhole, ShieldAlert, Trash2 } from 'lucide-react';
import type { House } from '@/app/types';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { EmptyState } from '@/app/components/shared/AsyncState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RestrictedDncRecord {
  id: string;
  house_id: string;
  territory_id: string;
  address: string;
  notes: string | null;
  coordinates: [number, number];
  warning_radius_m: number;
  key_version: number;
  migration_pending: boolean;
}

interface DncManagerProps {
  territoryId: string;
  houses: House[];
  onChanged: () => Promise<void>;
}

export function DncManager({ territoryId, houses, onChanged }: DncManagerProps) {
  const [records, setRecords] = useState<RestrictedDncRecord[]>([]);
  const [selected, setSelected] = useState<House | null>(null);
  const [notes, setNotes] = useState('');
  const [radius, setRadius] = useState('35');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ records: RestrictedDncRecord[] }>(
        `/api/dnc?territory_id=${encodeURIComponent(territoryId)}`,
      );
      setRecords(response.records);
    } catch (loadError) {
      setError(formatClientError(loadError));
    } finally {
      setLoading(false);
    }
  }, [territoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restrict = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/dnc', {
        method: 'POST',
        body: JSON.stringify({
          houseId: selected.id,
          notes: notes || null,
          warningRadiusM: Number(radius),
        }),
      });
      setSelected(null);
      setNotes('');
      setRadius('35');
      await Promise.all([load(), onChanged()]);
    } catch (restrictError) {
      setError(formatClientError(restrictError));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (recordId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/dnc/${recordId}`, { method: 'DELETE' });
      await Promise.all([load(), onChanged()]);
    } catch (restoreError) {
      setError(formatClientError(restoreError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <LockKeyhole aria-hidden="true" className="size-5" />
            </span>
            <div>
              <CardTitle>Restricted DNC register</CardTitle>
              <CardDescription>
                Exact addresses and notes are decrypted only for managers. Publishers receive a generic proximity warning and a masked offline tombstone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {houses.map((house) => (
              <Button key={house.id} variant="outline" onClick={() => {
                setSelected(house);
                setNotes(house.notes ?? '');
              }}>
                <ShieldAlert aria-hidden="true" /> Restrict {house.address}
              </Button>
            ))}
          </div>
          {loading ? <p role="status" className="text-sm text-muted-foreground">Loading restricted records…</p> : null}
          {!loading && records.length === 0 ? (
            <EmptyState title="No restricted addresses" description="Use a house button above when a resident asks not to be called on." icon={ShieldAlert} />
          ) : null}
          {records.length ? (
            <ul className="divide-y" aria-label="Restricted DNC records">
              {records.map((record) => (
                <li key={record.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="font-bold">{record.address}</p>
                    <p className="text-sm text-muted-foreground">
                      Warning radius {record.warning_radius_m}m · key version {record.key_version}
                      {record.migration_pending ? ' · migration verification pending' : ''}
                    </p>
                    {record.notes ? <p className="mt-1 text-sm">{record.notes}</p> : null}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy}><Trash2 aria-hidden="true" /> Remove restriction</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore this address to the field list?</AlertDialogTitle>
                        <AlertDialogDescription>The encrypted address and notes will be restored to the house record and the DNC warning will be deactivated.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void restore(record.id)}>Restore address</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restrict {selected?.address}</DialogTitle>
            <DialogDescription>The address and optional note are encrypted before the house is removed from publisher offline data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dnc-notes">Private manager note</Label>
              <Textarea id="dnc-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
            </div>
            <div>
              <Label htmlFor="dnc-radius">Generic warning radius in metres</Label>
              <Input id="dnc-radius" type="number" min={5} max={500} value={radius} onChange={(event) => setRadius(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={busy || Number(radius) < 5 || Number(radius) > 500} onClick={() => void restrict()}>
              {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ShieldAlert aria-hidden="true" />} Encrypt and restrict
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
