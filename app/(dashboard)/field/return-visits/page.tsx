'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MapPinned, RotateCcw } from 'lucide-react';
import { EmptyState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { VisitDialog } from '@/app/components/field/VisitDialog';
import { useAuth } from '@/app/hooks/useAuth';
import { useHouses, useRxDB, useVisits } from '@/app/hooks/useRxDB';
import { apiFetch, ClientApiError, formatClientError } from '@/app/lib/api/client';
import { useSyncStore } from '@/app/lib/store';
import type { House, VisitOutcome } from '@/app/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ReturnVisitsPage() {
  const { user } = useAuth();
  const congregationId = user?.congregation_id;
  const { visits, isLoading } = useVisits(congregationId);
  const { houses } = useHouses(undefined, congregationId);
  const { db } = useRxDB(congregationId);
  const [selected, setSelected] = useState<House | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const returns = useMemo(() => visits.filter((visit) => visit.follow_up_at && !visit.deleted_at).sort((a, b) => new Date(a.follow_up_at!).getTime() - new Date(b.follow_up_at!).getTime()), [visits]);

  const saveVisit = async (input: { outcome: VisitOutcome; notes: string | null; followUpAt: string | null }) => {
    if (!selected || !user || !db) return;
    const now = new Date().toISOString();
    const payload = { id: crypto.randomUUID(), houseId: selected.id, territoryId: selected.territory_id, outcome: input.outcome, notes: input.notes, visitedAt: now, followUpAt: input.followUpAt, mutationId: crypto.randomUUID() };
    let queued = !navigator.onLine;
    if (!queued) {
      try { await apiFetch('/api/visits', { method: 'POST', body: JSON.stringify(payload) }); }
      catch (error) {
        if (!(error instanceof ClientApiError) || (error.status ?? 500) >= 500) queued = true;
        else throw new Error(formatClientError(error));
      }
    }
    if (queued) {
      await db.visits.insert({ id: payload.id, house_id: selected.id, territory_id: selected.territory_id, congregation_id: user.congregation_id, visitor_id: user.id, outcome: input.outcome, notes: input.outcome === 'do-not-call' ? null : input.notes, visited_at: now, follow_up_at: input.followUpAt, mutation_id: payload.mutationId, created_at: now, version: 1, server_updated_at: now, deleted_at: null, _deleted: false });
      const current = useSyncStore.getState().pendingChanges; useSyncStore.getState().setPendingChanges(current + 1);
    }
    if (input.outcome === 'do-not-call') {
      const localHouse = await db.houses.findOne(selected.id).exec(); if (localHouse) await localHouse.remove();
    }
    setMessage(queued ? 'Return visit saved offline and queued.' : 'Return visit outcome saved.');
  };

  if (isLoading) return <LoadingState label="Loading return visits…" />;
  return <div className="space-y-7"><PageHeader eyebrow="Field follow-up" title="Return visits" description="Scheduled follow-ups come from append-only visit history and remain available with downloaded assignments." />{message ? <p role="status" className="rounded-xl border bg-primary/5 p-3 font-semibold text-primary">{message}</p> : null}{returns.length === 0 ? <EmptyState title="No return visits scheduled" description="Choose “Return visit” when recording an outcome to add one here." icon={RotateCcw} action={<Button asChild><Link href="/field"><MapPinned aria-hidden="true" /> Open field map</Link></Button>} /> : <div className="grid gap-3">{returns.map((visit) => { const house = houses.find((item) => item.id === visit.house_id); return <Card key={visit.id}><CardContent className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"><div><p className="font-bold">{house?.address ?? 'Address unavailable offline'}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock aria-hidden="true" className="size-4" />{new Date(visit.follow_up_at!).toLocaleString()}</p>{visit.notes ? <p className="mt-2 text-sm">{visit.notes}</p> : null}</div><Button disabled={!house} onClick={() => setSelected(house ?? null)}>Record outcome</Button></CardContent></Card>; })}</div>}<VisitDialog house={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onSave={saveVisit} /></div>;
}
