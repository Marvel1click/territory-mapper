'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, Circle, Map as MapIcon, RotateCcw } from 'lucide-react';
import type { DncWarning, House, Territory } from '@/app/types';
import { Badge } from '@/components/ui/badge';

const statusColor: Record<House['status'], string> = {
  'not-visited': '#6b7280',
  nah: '#9a651d',
  interest: '#2e6349',
  'return-visit': '#66549a',
  dnc: '#a23e35',
};

export function FieldMap({ territory, houses, warnings, selectedHouseId, onSelectHouse }: { territory: Territory; houses: House[]; warnings: DncWarning[]; selectedHouseId?: string | null; onSelectHouse: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const selectRef = useRef(onSelectHouse);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => { selectRef.current = onSelectHouse; }, [onSelectHouse]);
  useEffect(() => {
    if (!container.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: container.current, style: 'mapbox://styles/mapbox/streets-v12', center: territory.center, zoom: 15 });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true }), 'top-right');
    map.on('load', () => {
      map.addSource('field-territory', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: territory.boundary } });
      map.addLayer({ id: 'field-territory-fill', type: 'fill', source: 'field-territory', paint: { 'fill-color': territory.color, 'fill-opacity': 0.09 } });
      map.addLayer({ id: 'field-territory-line', type: 'line', source: 'field-territory', paint: { 'line-color': territory.color, 'line-width': 3 } });
      map.addSource('field-houses', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'field-houses-points', type: 'circle', source: 'field-houses', paint: { 'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 11, 8], 'circle-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
      map.addLayer({ id: 'field-houses-labels', type: 'symbol', source: 'field-houses', minzoom: 16, layout: { 'text-field': ['get', 'shortAddress'], 'text-offset': [0, 1.25], 'text-size': 12 }, paint: { 'text-color': '#20251f', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      map.addSource('dnc-warnings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'dnc-warning-radius', type: 'circle', source: 'dnc-warnings', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 18, 42], 'circle-color': '#a23e35', 'circle-opacity': 0.16, 'circle-stroke-color': '#a23e35', 'circle-stroke-width': 2 } });
      map.on('click', 'field-houses-points', (event) => { const id = event.features?.[0]?.properties?.id; if (typeof id === 'string') selectRef.current(id); });
      map.on('mouseenter', 'field-houses-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'field-houses-points', () => { map.getCanvas().style.cursor = ''; });
      setLoaded(true);
    });
    map.on('error', () => setError('Basemap unavailable. Switch to the labeled list to continue.'));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [territory, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource('field-houses') as mapboxgl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: houses.map((house) => ({ type: 'Feature', id: house.id, properties: { id: house.id, color: statusColor[house.status], selected: house.id === selectedHouseId, shortAddress: house.address.split(',')[0] }, geometry: { type: 'Point', coordinates: house.coordinates } })) });
    (map.getSource('dnc-warnings') as mapboxgl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: warnings.map((warning) => ({ type: 'Feature', id: warning.id, properties: { label: warning.label, radius: warning.warning_radius_m }, geometry: { type: 'Point', coordinates: warning.coordinates } })) });
  }, [houses, loaded, selectedHouseId, warnings]);

  if (!token) return <div className="grid h-[56dvh] min-h-[420px] place-items-center rounded-2xl border bg-muted p-8 text-center"><div><MapIcon aria-hidden="true" className="mx-auto mb-3 size-10 text-primary" /><p className="font-bold">Basemap unavailable</p><p className="mt-1 text-sm text-muted-foreground">Use the field list; downloaded assignment data remains available.</p></div></div>;
  return <div className="relative h-[56dvh] min-h-[420px] overflow-hidden rounded-2xl border"><div ref={container} className="absolute inset-0" aria-label={`Map of ${territory.name}`} /><div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 rounded-xl border bg-card/95 p-2 text-xs shadow-lg" aria-label="Map status legend"><Badge variant="outline"><Circle aria-hidden="true" className="fill-muted-foreground text-muted-foreground" /> Not visited</Badge><Badge variant="outline"><Circle aria-hidden="true" className="fill-primary text-primary" /> Interest</Badge><Badge variant="outline"><RotateCcw aria-hidden="true" /> Return visit</Badge>{warnings.length ? <Badge variant="destructive"><AlertTriangle aria-hidden="true" /> DNC warning radius</Badge> : null}</div>{error ? <p role="alert" className="absolute left-3 right-3 top-3 rounded-xl bg-card p-3 text-sm font-bold text-destructive">{error}</p> : null}</div>;
}
