'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapStore } from '@/app/lib/store';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { cn } from '@/app/lib/utils';
import { AlertCircle } from 'lucide-react';

interface MapContainerProps {
  className?: string;
  children?: React.ReactNode;
  onMapLoad?: (map: mapboxgl.Map) => void;
}

export function MapContainer({ className, children, onMapLoad }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { longitude, latitude, zoom, setViewport } = useMapStore();
  const { highContrast } = useAccessibility();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for Mapbox token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!mapboxToken && typeof window !== 'undefined') {
    console.warn('Mapbox token is not configured. Map functionality will be limited.');
  }

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
        center: [longitude, latitude],
        zoom: zoom,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });

      // Add navigation controls
      initializedMap.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add geolocate control
      initializedMap.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'top-right'
      );

      // Add scale control
      initializedMap.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      // Handle map events
      initializedMap.on('load', () => {
        setIsLoaded(true);
        onMapLoad?.(initializedMap);
      });

      initializedMap.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map. Please check your Mapbox configuration.');
      });

      initializedMap.on('move', () => {
        const center = initializedMap.getCenter();
        setViewport({
          longitude: center.lng,
          latitude: center.lat,
          zoom: initializedMap.getZoom(),
        });
      });

      map.current = initializedMap;

      return () => {
        initializedMap.remove();
        map.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError('Failed to initialize map. Please try again later.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highContrast]); // Reinitialize on high contrast change - intentionally limited dependencies

  // Update map style when high contrast changes
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    
    map.current.setStyle(
      highContrast
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/streets-v12'
    );
  }, [highContrast, isLoaded]);

  return (
    <div className={cn('relative w-full h-full overflow-hidden', className)}>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map overlay content */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto">{children}</div>
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
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
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to access map instance - must be used inside MapContainer's children
// TODO: Implement proper map context provider
export function useMapInstance(): mapboxgl.Map | null {
  // Placeholder implementation - returns null
  // In a full implementation, this would use React Context to access the parent map
  return null;
}
