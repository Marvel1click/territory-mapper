'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Archive, Home, Loader2, Plus } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { HouseStatusBadge, TerritoryStatusBadge } from '@/app/components/shared/StatusBadge';
import { HouseImport } from '@/app/components/territory/HouseImport';
import { DncManager } from '@/app/components/territory/DncManager';
import { TerritoryEditorForm } from '@/app/components/territory/TerritoryEditorForm';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import type { House, Territory } from '@/app/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export default function TerritoryDetailPage() {
  const id = String(useParams().id);
  const router = useRouter();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [houseOpen, setHouseOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [territoryResponse, housesResponse] = await Promise.all([
        apiFetch<{ territory: Territory }>(`/api/territories/${id}`),
        apiFetch<{ houses: House[] }>(`/api/houses?territory_id=${encodeURIComponent(id)}`),
      ]);
      setTerritory(territoryResponse.territory);
      setHouses(housesResponse.houses);
    } catch (loadError) { setError(formatClientError(loadError)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const addHouse = async () => {
    setBusy(true); setError(null);
    try {
      await apiFetch('/api/houses', { method: 'POST', body: JSON.stringify({ territory_id: id, address, coordinates: [Number(longitude), Number(latitude)], status: 'not-visited', notes: notes || null, is_dnc: false }) });
      setHouseOpen(false); setAddress(''); setLatitude(''); setLongitude(''); setNotes('');
      await load();
    } catch (addError) { setError(formatClientError(addError)); }
    finally { setBusy(false); }
  };

  const archive = async () => {
    setBusy(true);
    try { await apiFetch(`/api/territories/${id}`, { method: 'DELETE' }); router.push('/dashboard/territories'); }
    catch (archiveError) { setError(formatClientError(archiveError)); setBusy(false); }
  };

  if (loading) return <LoadingState label="Loading territory…" />;
  if (error && !territory) return <ErrorState message={error} retry={() => void load()} />;
  if (!territory) return null;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Territory" title={territory.name} description={territory.description || 'No territory description has been added.'} actions={<><TerritoryStatusBadge status={territory.status} /><AlertDialog><AlertDialogTrigger asChild><Button variant="outline"><Archive aria-hidden="true" /> Archive</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive {territory.name}?</AlertDialogTitle><AlertDialogDescription>This creates a recoverable soft-delete tombstone. Active assignments must be returned first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void archive()}>Archive territory</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>} />
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{error}</p> : null}
      <Tabs defaultValue="houses">
        <TabsList><TabsTrigger value="houses">Houses ({houses.length})</TabsTrigger><TabsTrigger value="dnc">DNC register</TabsTrigger><TabsTrigger value="boundary">Boundary & details</TabsTrigger><TabsTrigger value="import">CSV import</TabsTrigger></TabsList>
        <TabsContent value="houses" className="space-y-4">
          <div className="flex justify-end"><Dialog open={houseOpen} onOpenChange={setHouseOpen}><DialogTrigger asChild><Button><Plus aria-hidden="true" /> Add house</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add a house</DialogTitle><DialogDescription>Enter a reviewed address and map coordinates.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="house-address">Address</Label><Input id="house-address" value={address} onChange={(event) => setAddress(event.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="house-lat">Latitude</Label><Input id="house-lat" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></div><div><Label htmlFor="house-lng">Longitude</Label><Input id="house-lng" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></div></div><div><Label htmlFor="house-notes">Notes</Label><Textarea id="house-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setHouseOpen(false)}>Cancel</Button><Button disabled={busy || !address || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))} onClick={() => void addHouse()}>{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />} Add house</Button></DialogFooter></DialogContent></Dialog></div>
          {houses.length === 0 ? <EmptyState title="No houses yet" description="Add an address manually or import a reviewed CSV." icon={Home} /> : <Card><CardHeader><CardTitle>Field addresses</CardTitle><CardDescription>Exact DNC details are restricted; publishers receive only proximity warnings.</CardDescription></CardHeader><CardContent><ul className="divide-y">{houses.map((house) => <li key={house.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-bold">{house.address}</p><p className="text-sm text-muted-foreground">{house.coordinates[1].toFixed(5)}, {house.coordinates[0].toFixed(5)}</p></div><HouseStatusBadge status={house.status} /></li>)}</ul></CardContent></Card>}
        </TabsContent>
        <TabsContent value="dnc"><DncManager territoryId={id} houses={houses} onChanged={load} /></TabsContent>
        <TabsContent value="boundary"><TerritoryEditorForm territory={territory} /></TabsContent>
        <TabsContent value="import"><HouseImport territoryId={id} onImported={() => void load()} /></TabsContent>
      </Tabs>
    </div>
  );
}
