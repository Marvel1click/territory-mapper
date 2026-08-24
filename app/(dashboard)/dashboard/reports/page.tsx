'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, FileJson2, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import type { Assignment, Territory, Visit } from '@/app/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VisitRow extends Visit { houses?: { address: string; coordinates: [number, number] } | null; territories?: { name: string } | null }

function safeCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [territoryData, assignmentData, visitData] = await Promise.all([
        apiFetch<{ territories: Territory[] }>('/api/territories'),
        apiFetch<{ assignments: Assignment[] }>('/api/assignments'),
        apiFetch<{ visits: VisitRow[] }>('/api/visits'),
      ]);
      setTerritories(territoryData.territories); setAssignments(assignmentData.assignments); setVisits(visitData.visits);
    } catch (loadError) { setError(formatClientError(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState label="Preparing reports…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;

  const exportTerritories = () => download(`territories-${new Date().toISOString().slice(0, 10)}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: territories.map((territory) => ({ type: 'Feature', id: territory.id, properties: { name: territory.name, description: territory.description, status: territory.status }, geometry: territory.boundary })) }, null, 2), 'application/geo+json');
  const exportAssignments = () => download(`assignments-${new Date().toISOString().slice(0, 10)}.csv`, [['territory_id', 'publisher_name', 'status', 'checked_out_at', 'due_date', 'returned_at'], ...assignments.map((item) => [item.territory_id, item.publisher_name, item.status, item.checked_out_at, item.due_date, item.returned_at])].map((row) => row.map(safeCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  const exportVisits = () => download(`visits-${new Date().toISOString().slice(0, 10)}.csv`, [['territory', 'house', 'outcome', 'visited_at', 'follow_up_at', 'notes'], ...visits.map((item) => [item.territories?.name ?? item.territory_id, item.houses?.address ?? item.house_id, item.outcome, item.visited_at, item.follow_up_at, item.notes])].map((row) => row.map(safeCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');

  const returned = assignments.filter((assignment) => assignment.status === 'returned').length;
  const followUps = visits.filter((visit) => visit.follow_up_at).length;
  const cards = [
    { label: 'Territories', value: territories.length, detail: `${territories.filter((territory) => territory.status === 'in-stock').length} available` },
    { label: 'Assignments returned', value: returned, detail: `${assignments.filter((assignment) => assignment.status === 'active').length} active` },
    { label: 'Visits recorded', value: visits.length, detail: `${followUps} return visits` },
  ];

  return <div className="space-y-7"><PageHeader eyebrow="Reports & exports" title="Portable records, without behavioral analytics." description="Download congregation-authorized operational data. Spreadsheet formula prefixes are neutralized during CSV export." />
    <section aria-label="Report summary" className="grid gap-4 md:grid-cols-3">{cards.map((card) => <Card key={card.label}><CardContent className="pt-6"><BarChart3 aria-hidden="true" className="mb-4 text-primary" /><p className="text-sm font-semibold text-muted-foreground">{card.label}</p><p className="text-4xl font-bold tabular-nums">{card.value}</p><p className="mt-1 text-sm text-muted-foreground">{card.detail}</p></CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle>Download data</CardTitle><CardDescription>Exports reflect the current server-authorized congregation view.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><ExportButton icon={FileJson2} title="Territories" detail="GeoJSON boundaries and statuses" onClick={exportTerritories} /><ExportButton icon={FileSpreadsheet} title="Assignments" detail="CSV checkout history" onClick={exportAssignments} /><ExportButton icon={RotateCcw} title="Visits" detail="CSV outcomes and follow-ups" onClick={exportVisits} /></CardContent></Card>
  </div>;
}

function ExportButton({ icon: Icon, title, detail, onClick }: { icon: typeof Download; title: string; detail: string; onClick: () => void }) {
  return <Button variant="outline" className="h-auto justify-start px-4 py-5 text-left" onClick={onClick}><Icon aria-hidden="true" className="size-6 text-primary" /><span><span className="block font-bold">{title}</span><span className="block text-xs font-normal text-muted-foreground">{detail}</span></span><Download aria-hidden="true" className="ml-auto" /></Button>;
}
