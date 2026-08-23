'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, List, Loader2, Map as MapIcon, RotateCcw } from 'lucide-react';
import { FieldMap } from '@/app/components/map/FieldMap';
import { VisitDialog } from '@/app/components/field/VisitDialog';
import { EmptyState, LoadingState } from '@/app/components/shared/AsyncState';
import { HouseStatusBadge } from '@/app/components/shared/StatusBadge';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { useAuth } from '@/app/hooks/useAuth';
import { useAssignments, useHouses, useRxDB, useSync, useTerritories } from '@/app/hooks/useRxDB';
import { apiFetch, ClientApiError, formatClientError } from '@/app/lib/api/client';
import { useSyncStore } from '@/app/lib/store';
import { calculateDistance } from '@/app/lib/utils';
import type { DncWarning, House, VisitOutcome } from '@/app/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FieldPage() {
  const { user } = useAuth();
  const congregationId = user?.congregation_id;
  const { db } = useRxDB(congregationId);
  const { territories, isLoading: territoriesLoading } = useTerritories(congregationId);
  const { assignments, isLoading: assignmentsLoading } = useAssignments(congregationId);
  const [territoryId, setTerritoryId] = useState<string>('');
  const { houses, isLoading: housesLoading } = useHouses(territoryId || undefined, congregationId);
  const { sync, isSyncing } = useSync(congregationId);
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  const [warnings, setWarnings] = useState<DncWarning[]>([]);
  const [warningState, setWarningState] = useState<'ready' | 'offline' | 'loading'>('loading');
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [locationAlertsEnabled, setLocationAlertsEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const lastDncAlert = useRef<Map<string, number>>(new globalThis.Map());

  const activeAssignments = useMemo(() => assignments.filter((assignment) => assignment.status === 'active'), [assignments]);
  const assignedTerritories = useMemo(() => territories.filter((territory) => activeAssignments.some((assignment) => assignment.territory_id === territory.id)), [activeAssignments, territories]);
  const territory = assignedTerritories.find((item) => item.id === territoryId) ?? assignedTerritories[0] ?? null;
  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? null;

  useEffect(() => {
    if (!territoryId && assignedTerritories[0]) setTerritoryId(assignedTerritories[0].id);
  }, [assignedTerritories, territoryId]);

  useEffect(() => {
    if (!territory?.id) return;
    let active = true;
    setWarningState('loading');
    apiFetch<{ warnings: DncWarning[] }>(`/api/dnc?territory_id=${encodeURIComponent(territory.id)}`)
      .then((response) => { if (active) { setWarnings(response.warnings); setWarningState('ready'); } })
      .catch(() => { if (active) { setWarnings([]); setWarningState('offline'); } });
    return () => { active = false; };
  }, [territory?.id]);

  useEffect(() => {
    if (!locationAlertsEnabled || !warnings.length || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((position) => {
      warnings.forEach((warning) => {
        const distance = calculateDistance(position.coords.latitude, position.coords.longitude, warning.coordinates[1], warning.coordinates[0]);
        const last = lastDncAlert.current.get(warning.id) ?? 0;
        if (distance <= warning.warning_radius_m && Date.now() - last > 30_000) {
          lastDncAlert.current.set(warning.id, Date.now());
          triggerHaptic(hapticPatterns.dncProximity);
          setMessage('Do not call warning nearby. Exact address details are restricted.');
        }
      });
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 15_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hapticPatterns.dncProximity, locationAlertsEnabled, triggerHaptic, warnings]);

  const storeOfflineVisit = useCallback(async (
    house: House,
    input: { outcome: VisitOutcome; notes: string | null; followUpAt: string | null },
    identity: { id: string; mutationId: string; visitedAt: string },
  ) => {
    if (!db || !user) throw new Error('Offline storage is not ready yet.');
    await db.visits.insert({
      id: identity.id, house_id: house.id, territory_id: house.territory_id,
      congregation_id: user.congregation_id, visitor_id: user.id, outcome: input.outcome,
      notes: input.outcome === 'do-not-call' ? null : input.notes, visited_at: identity.visitedAt, follow_up_at: input.followUpAt,
      mutation_id: identity.mutationId, created_at: identity.visitedAt, version: 1,
      server_updated_at: identity.visitedAt, deleted_at: null, _deleted: false,
    });
    const currentPending = useSyncStore.getState().pendingChanges;
    useSyncStore.getState().setPendingChanges(currentPending + 1);
  }, [db, user]);

  const saveVisit = async (input: { outcome: VisitOutcome; notes: string | null; followUpAt: string | null }) => {
    if (!selectedHouse || !user) return;
    const payload = { id: crypto.randomUUID(), houseId: selectedHouse.id, territoryId: selectedHouse.territory_id, outcome: input.outcome, notes: input.notes, visitedAt: new Date().toISOString(), followUpAt: input.followUpAt, mutationId: crypto.randomUUID() };
    let queued = !navigator.onLine;
    if (!queued) {
      try { await apiFetch('/api/visits', { method: 'POST', body: JSON.stringify(payload) }); }
      catch (saveError) {
        if (!(saveError instanceof ClientApiError) || (saveError.status ?? 500) >= 500) queued = true;
        else throw new Error(formatClientError(saveError));
      }
    }
    if (queued) await storeOfflineVisit(selectedHouse, input, payload);
    if (input.outcome === 'do-not-call' && db) {
      const localHouse = await db.houses.findOne(selectedHouse.id).exec();
      if (localHouse) await localHouse.remove();
      triggerHaptic(hapticPatterns.warning);
    } else triggerHaptic(hapticPatterns.success);
    setRecorded((current) => new Set(current).add(selectedHouse.id));
    setMessage(queued
      ? input.outcome === 'do-not-call' && input.notes
        ? 'DNC saved offline and queued. The sensitive note was discarded because it cannot be encrypted while offline.'
        : 'Visit saved offline and queued for synchronization.'
      : 'Visit saved to append-only history.');
  };

  const returnTerritory = async () => {
    const assignment = activeAssignments.find((item) => item.territory_id === territory?.id);
    if (!assignment) return;
    await apiFetch(`/api/assignments/${assignment.id}`, { method: 'PUT', body: JSON.stringify({ mutationId: crypto.randomUUID() }) });
    await sync();
    setMessage('Territory returned.');
  };

  const loading = territoriesLoading || assignmentsLoading;
  if (loading) return <LoadingState label="Preparing downloaded assignments…" />;
  if (!territory) return <EmptyState title="No active territory assignment" description="Ask an overseer for a direct assignment or scan a valid one-time checkout QR." icon={ClipboardCheck} />;

  return <div className="space-y-5"><header><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Field mode</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">{territory.name}</h1><p className="mt-1 text-muted-foreground">{houses.length} field address{houses.length === 1 ? '' : 'es'} downloaded</p></div><div className="flex gap-2"><Select value={territory.id} onValueChange={setTerritoryId}><SelectTrigger aria-label="Active territory" className="min-w-48"><SelectValue /></SelectTrigger><SelectContent>{assignedTerritories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={isSyncing} onClick={() => void sync()}>{isSyncing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />} Download</Button></div></div></header>
    <div aria-live="polite">{message ? <Alert className={message.startsWith('Do not') ? 'border-destructive/40' : ''}>{message.startsWith('Do not') ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<AlertTitle>{message.startsWith('Do not') ? 'DNC proximity alert' : 'Field update'}</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}</div>
    {warningState === 'offline' ? <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 p-3 text-sm font-semibold">DNC warning locations need a connection and are currently unavailable. Previously downloaded non-DNC assignment data is still ready.</p> : null}
    {warningState === 'ready' && warnings.length ? <Button variant="outline" aria-pressed={locationAlertsEnabled} onClick={() => setLocationAlertsEnabled((enabled) => !enabled)}><AlertTriangle aria-hidden="true" /> {locationAlertsEnabled ? 'Disable nearby DNC alerts' : 'Enable nearby DNC alerts'}</Button> : null}
    <Tabs defaultValue="map"><TabsList className="grid w-full grid-cols-2 sm:w-72"><TabsTrigger value="map"><MapIcon aria-hidden="true" /> Map</TabsTrigger><TabsTrigger value="list"><List aria-hidden="true" /> List</TabsTrigger></TabsList><TabsContent value="map"><FieldMap territory={territory} houses={houses} warnings={warnings} selectedHouseId={selectedHouseId} onSelectHouse={(id) => { setSelectedHouseId(id); setVisitOpen(true); }} /></TabsContent><TabsContent value="list">{housesLoading ? <LoadingState label="Loading field addresses…" /> : houses.length === 0 ? <EmptyState title="No callable addresses" description="This assignment may not have imported houses yet. DNC addresses are intentionally excluded." /> : <div className="grid gap-3">{houses.map((house, index) => <Card key={house.id}><CardContent className="flex items-center gap-4 py-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted font-bold tabular-nums">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{house.address}</p><div className="mt-1"><HouseStatusBadge status={recorded.has(house.id) ? 'interest' : house.status} /></div></div><Button onClick={() => { setSelectedHouseId(house.id); setVisitOpen(true); }}>Record visit</Button></CardContent></Card>)}</div>}</TabsContent></Tabs>
    <div className="flex justify-end"><Button variant="outline" onClick={() => void returnTerritory()}><RotateCcw aria-hidden="true" /> Return territory</Button></div>
    <VisitDialog house={selectedHouse} open={visitOpen} onOpenChange={setVisitOpen} onSave={saveVisit} />
  </div>;
}
