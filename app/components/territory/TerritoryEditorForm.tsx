'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { BoundaryEditor } from '@/app/components/map/BoundaryEditor';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { validateBoundary } from '@/app/lib/utils/validation';
import type { Territory } from '@/app/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function TerritoryEditorForm({ territory }: { territory?: Territory }) {
  const router = useRouter();
  const [name, setName] = useState(territory?.name ?? '');
  const [description, setDescription] = useState(territory?.description ?? '');
  const [color, setColor] = useState(territory?.color ?? '#2f6f4e');
  const [boundary, setBoundary] = useState<number[][][] | null>(territory?.boundary.coordinates ?? null);
  const [boundaryText, setBoundaryText] = useState(
    territory ? JSON.stringify(territory.boundary.coordinates, null, 2) : '',
  );
  const [boundaryValid, setBoundaryValid] = useState(Boolean(territory));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyBoundaryText = () => {
    try {
      const coordinates: unknown = JSON.parse(boundaryText);
      const polygon = { type: 'Polygon', coordinates };
      if (!validateBoundary(polygon)) throw new Error('invalid');
      setBoundary(polygon.coordinates);
      setBoundaryValid(true);
      setBoundaryText(JSON.stringify(polygon.coordinates, null, 2));
      setError(null);
    } catch {
      setBoundaryValid(false);
      setError('Boundary coordinates must be valid, bounded [longitude, latitude] pairs in a closed GeoJSON polygon ring.');
    }
  };

  const save = async () => {
    if (!name.trim() || !boundary || !boundaryValid) {
      setError('Add a name and a closed map boundary before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch<{ territory: Territory }>(territory ? `/api/territories/${territory.id}` : '/api/territories', {
        method: territory ? 'PUT' : 'POST',
        body: JSON.stringify({ name, description: description || null, color, boundary: { type: 'Polygon', coordinates: boundary }, ...(territory ? { version: territory.version } : {}) }),
      });
      router.push(`/dashboard/territories/${response.territory.id}`);
      router.refresh();
    } catch (saveError) {
      setError(formatClientError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader><CardTitle>Territory details</CardTitle><CardDescription>Use a concise field name and optional context.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div><Label htmlFor="territory-name">Name</Label><Input id="territory-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Riverside North" /></div>
          <div><Label htmlFor="territory-description">Description</Label><Textarea id="territory-description" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} placeholder="Landmarks or field notes that are safe for all assignees" /></div>
          <div><Label htmlFor="territory-color">Map color</Label><div className="flex gap-3"><Input id="territory-color" type="color" className="w-16 p-1" value={color} onChange={(event) => setColor(event.target.value)} /><Input aria-label="Color hex value" value={color} pattern="#[0-9A-Fa-f]{6}" onChange={(event) => setColor(event.target.value)} /></div></div>
          <div className="space-y-2"><Label htmlFor="boundary-coordinates">Boundary GeoJSON coordinates</Label><Textarea id="boundary-coordinates" className="min-h-40 font-mono text-xs" value={boundaryText} onChange={(event) => setBoundaryText(event.target.value)} placeholder="[[[-0.12,51.50],[-0.11,51.50],[-0.11,51.51],[-0.12,51.50]]]" aria-describedby="boundary-coordinates-help" /><p id="boundary-coordinates-help" className="text-xs text-muted-foreground">Keyboard alternative: paste one or more closed polygon rings as longitude/latitude pairs, then apply.</p><Button className="w-full" type="button" variant="outline" onClick={applyBoundaryText}>Apply coordinates</Button></div>
          {error ? <Alert variant="destructive" role="alert"><AlertTitle>Could not save</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button className="w-full" disabled={saving || !boundaryValid || !name.trim()} onClick={() => void save()}>{saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />} {territory ? 'Save territory' : 'Create territory'}</Button>
        </CardContent>
      </Card>
      <div>
        <div className="mb-3"><h2 className="text-xl font-bold">Map boundary</h2><p className="text-sm text-muted-foreground">Draw one closed polygon, or use the keyboard-accessible GeoJSON coordinates field.</p></div>
        <BoundaryEditor initialBoundary={territory?.boundary.coordinates} center={territory ? { lng: territory.center[0], lat: territory.center[1] } : undefined} height="600px" onChange={(coordinates, valid) => { setBoundary(coordinates); setBoundaryValid(valid); if (coordinates) setBoundaryText(JSON.stringify(coordinates, null, 2)); }} />
      </div>
    </div>
  );
}
