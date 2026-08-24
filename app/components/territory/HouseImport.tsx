'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, MapPin, Upload } from 'lucide-react';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ImportRow {
  row: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  isDnc: boolean;
  source?: 'csv' | 'mapbox' | 'unresolved';
  confidence?: number;
  error?: string;
}

function parseOptionalCoordinate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDnc(value: string | undefined): boolean {
  return ['true', 'yes', '1', 'dnc'].includes(value?.trim().toLowerCase() ?? '');
}

export function HouseImport({ territoryId, onImported }: { territoryId: string; onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = (file: File) => {
    setError(null);
    if (file.size > 2_000_000) {
      setError('CSV files must be smaller than 2 MB.');
      return;
    }
    setBusy(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toLowerCase().replaceAll(/[\s_-]+/g, ''),
      complete: async (result) => {
        try {
          if (result.errors.length) throw new Error(`CSV row ${(result.errors[0].row ?? 0) + 2}: ${result.errors[0].message}`);
          if (!result.meta.fields?.includes('address')) throw new Error('The CSV needs an address column.');
          if (result.data.length === 0 || result.data.length > 500) throw new Error('Import between 1 and 500 rows at a time.');
          const parsed = result.data.map((row, index) => ({
            row: index + 2,
            address: row.address?.trim() ?? '',
            latitude: parseOptionalCoordinate(row.latitude ?? row.lat),
            longitude: parseOptionalCoordinate(row.longitude ?? row.lng ?? row.lon),
            notes: row.notes?.trim() || null,
            isDnc: parseDnc(row.dnc ?? row.isdnc),
          }));
          if (parsed.some((row) => !row.address)) throw new Error('Every row needs an address.');
          const previewed: ImportRow[] = [];
          for (let index = 0; index < parsed.length; index += 100) {
            const response = await apiFetch<{ rows: ImportRow[] }>('/api/geocode/preview', {
              method: 'POST',
              body: JSON.stringify({ rows: parsed.slice(index, index + 100) }),
            });
            previewed.push(...response.rows);
          }
          setRows(previewed);
          setOpen(true);
        } catch (parseError) {
          setError(formatClientError(parseError));
        } finally {
          setBusy(false);
          if (inputRef.current) inputRef.current.value = '';
        }
      },
      error: (parseError) => {
        setError(parseError.message);
        setBusy(false);
      },
    });
  };

  const updateCoordinate = (index: number, field: 'latitude' | 'longitude', value: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value === '' ? null : Number(value), error: undefined, source: 'csv' } : row));
  };

  const unresolved = rows.filter((row) => row.latitude == null || row.longitude == null || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude));

  const importRows = async () => {
    if (unresolved.length) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/houses/import', {
        method: 'POST',
        body: JSON.stringify({ territoryId, rows }),
      });
      setOpen(false);
      setRows([]);
      onImported?.();
    } catch (importError) {
      setError(formatClientError(importError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border-2 border-dashed p-6 text-center">
        <FileSpreadsheet aria-hidden="true" className="mx-auto mb-3 size-9 text-primary" />
        <p className="font-bold">Import houses from CSV</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">Required: address. Optional: latitude, longitude, notes, dnc. Missing coordinates are geocoded for review before import.</p>
        <input ref={inputRef} className="sr-only" id="house-csv" type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && parseFile(event.target.files[0])} />
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />} {busy ? 'Preparing preview…' : 'Choose CSV'}
        </Button>
        {error && !open ? <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
      </div>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle>Review {rows.length} import rows</DialogTitle>
            <DialogDescription>Confirm geocoded matches. Enter coordinates manually for unresolved addresses.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[58dvh] space-y-3 overflow-y-auto px-6 py-4">
            {rows.map((row, index) => (
              <article key={`${row.row}-${row.address}`} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold"><MapPin aria-hidden="true" className="mr-1 inline size-4 text-primary" />{row.address}</p><p className="text-xs text-muted-foreground">CSV row {row.row}</p></div>
                  <div className="flex gap-2">{row.isDnc ? <Badge variant="destructive">Do not call · encrypted</Badge> : null}<Badge variant="outline">{row.source === 'mapbox' ? 'Geocoded' : row.source === 'csv' ? 'CSV coordinates' : 'Needs coordinates'}</Badge></div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor={`lat-${index}`}>Latitude</Label><Input id={`lat-${index}`} inputMode="decimal" value={row.latitude ?? ''} onChange={(event) => updateCoordinate(index, 'latitude', event.target.value)} /></div>
                  <div><Label htmlFor={`lng-${index}`}>Longitude</Label><Input id={`lng-${index}`} inputMode="decimal" value={row.longitude ?? ''} onChange={(event) => updateCoordinate(index, 'longitude', event.target.value)} /></div>
                </div>
                {row.error ? <p className="mt-2 text-sm text-destructive">{row.error}</p> : null}
              </article>
            ))}
          </div>
          <div className="border-t px-6 py-4">
            {unresolved.length ? <Alert variant="destructive" className="mb-4"><AlertTriangle aria-hidden="true" /><AlertTitle>{unresolved.length} unresolved row{unresolved.length === 1 ? '' : 's'}</AlertTitle><AlertDescription>Add valid coordinates before importing.</AlertDescription></Alert> : null}
            {error ? <p role="alert" className="mb-3 text-sm font-semibold text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy || unresolved.length > 0} onClick={() => void importRows()}>{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />} Import {rows.length} houses</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
