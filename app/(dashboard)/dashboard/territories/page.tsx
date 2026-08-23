'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Map, MapPinned, Plus, Search } from 'lucide-react';
import { TerritoryOverviewMap } from '@/app/components/map/TerritoryOverviewMap';
import { EmptyState, ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { TerritoryStatusBadge } from '@/app/components/shared/StatusBadge';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import type { Territory } from '@/app/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function downloadGeoJson(territories: Territory[]) {
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: territories.map((territory) => ({ type: 'Feature', id: territory.id, properties: { name: territory.name, description: territory.description, status: territory.status }, geometry: territory.boundary })) }, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `territories-${new Date().toISOString().slice(0, 10)}.geojson`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ territories: Territory[] }>('/api/territories');
      setTerritories(data.territories);
      setSelectedId((current) => current ?? data.territories[0]?.id ?? null);
    } catch (loadError) {
      setError(formatClientError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => territories.filter((territory) => `${territory.name} ${territory.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [query, territories]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Territory workspace"
        title="Draw, review, and prepare field territories."
        description="The labeled list and map stay together so boundaries, availability, and next actions are always clear."
        actions={
          <>
            <Button variant="outline" onClick={() => downloadGeoJson(filtered)} disabled={filtered.length === 0}><Download aria-hidden="true" /> GeoJSON</Button>
            <Button asChild><Link href="/dashboard/territories/new"><Plus aria-hidden="true" /> New territory</Link></Button>
          </>
        }
      />

      {loading ? <LoadingState label="Loading territories…" /> : error ? <ErrorState message={error} retry={() => void load()} /> : territories.length === 0 ? (
        <EmptyState title="Create your first territory" description="Draw a boundary, name it, and then add houses for field use." icon={MapPinned} action={<Button asChild><Link href="/dashboard/territories/new"><Plus aria-hidden="true" /> New territory</Link></Button>} />
      ) : (
        <div className="grid min-h-[600px] gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="sticky top-0 z-10 border-b bg-card p-4">
                <label htmlFor="territory-search" className="sr-only">Search territories</label>
                <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input id="territory-search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" placeholder="Search territories" /></div>
                <p className="mt-3 text-sm text-muted-foreground">{filtered.length} of {territories.length} territories</p>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {filtered.length === 0 ? <p className="p-8 text-center text-muted-foreground">No territories match that search.</p> : filtered.map((territory) => (
                  <article key={territory.id} className={`border-b p-4 transition-colors ${selectedId === territory.id ? 'bg-primary/8' : 'hover:bg-muted/50'}`}>
                    <button type="button" className="w-full rounded-lg text-left" onClick={() => setSelectedId(territory.id)}>
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-bold">{territory.name}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{territory.description || 'No description yet'}</p></div><span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded-full border-2 border-background shadow" style={{ backgroundColor: territory.color }} /></div>
                      <div className="mt-3"><TerritoryStatusBadge status={territory.status} /></div>
                    </button>
                    <Button variant="link" className="mt-2 h-auto px-0" asChild><Link href={`/dashboard/territories/${territory.id}`}><Map aria-hidden="true" /> Open territory</Link></Button>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
          <TerritoryOverviewMap territories={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      )}
    </div>
  );
}
