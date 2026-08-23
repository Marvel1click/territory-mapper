'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, LocateFixed, Map as MapIcon } from 'lucide-react';
import type { Territory } from '@/app/types';
import { Button } from '@/components/ui/button';

export function TerritoryOverviewMap({
  territories,
  selectedId,
  onSelect,
  className = 'h-[560px]',
}: {
  territories: Territory[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const territoriesRef = useRef(territories);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    onSelectRef.current = onSelect;
    territoriesRef.current = territories;
  }, [onSelect, territories]);

  useEffect(() => {
    if (!container.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const first = territoriesRef.current[0]?.center ?? [-0.1276, 51.5074];
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: first,
      zoom: territoriesRef.current.length ? 12 : 10,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('territories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.4, 0.18],
        },
      });
      map.addLayer({
        id: 'territory-line',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 4, 2],
        },
      });
      map.addLayer({
        id: 'territory-label',
        type: 'symbol',
        source: 'territories',
        layout: {
          'text-field': ['concat', ['get', 'name'], ' · ', ['get', 'statusLabel']],
          'text-size': 13,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#153f2b', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });
      map.on('click', 'territory-fill', (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === 'string') onSelectRef.current?.(id);
      });
      map.on('mouseenter', 'territory-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'territory-fill', () => { map.getCanvas().style.cursor = ''; });
      setLoaded(true);
    });
    map.on('error', () => setError('The basemap could not be loaded. The territory list remains available.'));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !loaded) return;
    const source = map.getSource('territories') as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: territories.map((territory) => ({
        type: 'Feature',
        id: territory.id,
        geometry: territory.boundary,
        properties: {
          id: territory.id,
          name: territory.name,
          color: territory.color,
          selected: territory.id === selectedId,
          statusLabel: territory.status === 'in-stock' ? 'Available' : territory.status === 'out' ? 'Assigned' : 'Needs review',
        },
      })),
    });
  }, [loaded, selectedId, territories]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || territories.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    territories.forEach((territory) => territory.boundary.coordinates.flat().forEach((point) => bounds.extend(point as [number, number])));
    map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
  };

  if (!token) {
    return (
      <div className={`${className} grid place-items-center rounded-2xl border bg-muted/40 p-8 text-center`} role="status">
        <div className="max-w-sm"><MapIcon aria-hidden="true" className="mx-auto mb-3 size-10 text-primary" /><p className="font-bold">Map preview unavailable</p><p className="mt-1 text-sm text-muted-foreground">Add the public Mapbox token to enable the basemap. Every territory remains usable from the labeled list.</p></div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <div ref={container} className="absolute inset-0" aria-label="Interactive territory map" />
      <Button type="button" variant="secondary" size="sm" className="absolute bottom-4 left-4 shadow-lg" onClick={fitAll}>
        <LocateFixed aria-hidden="true" /> Fit territories
      </Button>
      {error ? <div role="alert" className="absolute inset-x-4 top-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-card p-3 text-sm"><AlertTriangle aria-hidden="true" className="text-destructive" />{error}</div> : null}
    </div>
  );
}
