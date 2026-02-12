'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { cn } from '@/app/lib/utils';
import { Save, RotateCcw, MapPin, AlertCircle } from 'lucide-react';

interface BoundaryEditorProps {
  initialBoundary?: number[][][];
  onChange?: (boundary: number[][][] | null, isValid: boolean) => void;
  onSave?: (boundary: number[][][]) => void;
  className?: string;
  height?: string;
  center?: { lng: number; lat: number };
}

export function BoundaryEditor({
  initialBoundary,
  onChange,
  onSave,
  className,
  height = '500px',
  center,
}: BoundaryEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const { highContrast, triggerHaptic, hapticPatterns } = useAccessibility();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPolygon, setHasPolygon] = useState(false);

  // Check for Mapbox token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!mapboxToken && typeof window !== 'undefined') {
    console.warn('Mapbox token is not configured. Map functionality will be limited.');
  }

  // Handle draw changes - defined before useEffect to avoid temporal dead zone
  const handleDrawChange = useCallback(() => {
    if (!draw.current) return;

    const features = draw.current.getAll();
    const polygon = features.features.find((f: { geometry?: { type?: string } }) => f.geometry?.type === 'Polygon');

    if (polygon) {
      setHasPolygon(true);
      const coordinates = (polygon.geometry as GeoJSON.Polygon).coordinates;
      onChange?.(coordinates, true);
      triggerHaptic(hapticPatterns.success);
    }
  }, [onChange, triggerHaptic, hapticPatterns]);

  // Handle draw delete - defined before useEffect
  const handleDrawDelete = useCallback(() => {
    setHasPolygon(false);
    onChange?.(null, false);
    triggerHaptic(hapticPatterns.light);
  }, [onChange, triggerHaptic, hapticPatterns]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Check for Mapbox token
    if (!mapboxToken) {
      setError('Mapbox token is not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables.');
      return;
    }

    // Set the token
    mapboxgl.accessToken = mapboxToken;

    try {
      const initializedMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: highContrast
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/streets-v12',
        center: center ? [center.lng, center.lat] : [-0.1276, 51.5074],
        zoom: center ? 15 : 12,
      });

      // Add navigation controls
      initializedMap.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );

      // Initialize draw control
      const drawControl = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: 'draw_polygon',
        styles: getDrawStyles(highContrast),
      });

      initializedMap.addControl(drawControl, 'top-left');
      draw.current = drawControl;

      // Handle map load
      initializedMap.on('load', () => {
        setIsLoaded(true);

        // Load initial boundary if provided
        if (initialBoundary) {
          const feature = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: initialBoundary,
            },
          };
          // Type assertion needed for MapboxDraw.add() which expects GeoJSON
          drawControl.add(feature as unknown as Parameters<typeof drawControl.add>[0]);
          setHasPolygon(true);

          // Fit bounds to polygon
          const bounds = new mapboxgl.LngLatBounds();
          initialBoundary[0].forEach((coord) => {
            bounds.extend([coord[0], coord[1]]);
          });
          initializedMap.fitBounds(bounds, { padding: 50 });
        }
      });

      // Handle map errors
      initializedMap.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map. Please check your Mapbox configuration.');
      });

      // Handle draw events - now safe because handlers are defined above
      initializedMap.on('draw.create', handleDrawChange);
      initializedMap.on('draw.update', handleDrawChange);
      initializedMap.on('draw.delete', handleDrawDelete);

      map.current = initializedMap;

      return () => {
        initializedMap.remove();
        map.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError('Failed to initialize map. Please try again later.');
    }
  }, [highContrast, initialBoundary, handleDrawChange, handleDrawDelete, center, mapboxToken]);

  // Fly to center when it changes
  useEffect(() => {
    if (map.current && center && isLoaded) {
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: 15,
        essential: true,
      });
    }
  }, [center, isLoaded]);

  // Clear all drawings
  const handleClear = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setHasPolygon(false);
    onChange?.(null, false);
    triggerHaptic(hapticPatterns.medium);
  }, [onChange, triggerHaptic, hapticPatterns]);

  // Save boundary
  const handleSave = useCallback(() => {
    if (!draw.current || !hasPolygon) return;

    const features = draw.current.getAll();
    const polygon = features.features.find((f: { geometry?: { type?: string } }) => f.geometry?.type === 'Polygon');

    if (polygon) {
      const coordinates = (polygon.geometry as GeoJSON.Polygon).coordinates;
      onSave?.(coordinates);
      triggerHaptic(hapticPatterns.success);
    }
  }, [draw, hasPolygon, onSave, triggerHaptic, hapticPatterns]);

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-border', className)}>
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/95 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-border">
        <div className="flex items-center gap-2 px-3 border-r border-border">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {hasPolygon ? 'Boundary drawn' : 'Draw a polygon'}
          </span>
        </div>
        
        <button
          onClick={handleClear}
          disabled={!hasPolygon}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
        
        <button
          onClick={handleSave}
          disabled={!hasPolygon}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      {/* Map container */}
      <div
        ref={mapContainer}
        className="w-full"
        style={{ height }}
      />

      {/* Instructions overlay */}
      {!hasPolygon && isLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-border max-w-sm text-center">
          <p className="text-sm text-muted-foreground">
            Click on the map to start drawing a territory boundary.
            Click multiple points to create a polygon, then click the first point to close it.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-4 text-center max-w-sm p-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Map Error</h3>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isLoaded && !error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading map editor...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom draw styles based on high contrast mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDrawStyles(highContrast: boolean): any[] {
  const color = highContrast ? '#ffff00' : '#3b82f6';
  const fillColor = highContrast ? 'rgba(255, 255, 0, 0.2)' : 'rgba(59, 130, 246, 0.2)';

  return [
    // Active line
    {
      id: 'gl-draw-line',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': 3,
      },
    },
    // Polygon fill
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: {
        'fill-color': fillColor,
        'fill-outline-color': color,
        'fill-opacity': 0.5,
      },
    },
    // Polygon outline
    {
      id: 'gl-draw-polygon-stroke',
      type: 'line',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': 3,
      },
    },
    // Vertex points
    {
      id: 'gl-draw-point',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
      paint: {
        'circle-radius': 6,
        'circle-color': color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
  ];
}
