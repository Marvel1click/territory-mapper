'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Crosshair, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// Default UK center (London)
const UK_DEFAULT_CENTER: [number, number] = [-0.1276, 51.5074];
const UK_DEFAULT_ZOOM = 12;

interface LocationPickerProps {
  onLocationSelect?: (lngLat: { lng: number; lat: number }, address?: string) => void;
  className?: string;
  height?: string;
  showSearch?: boolean;
}

interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number];
  context?: Array<{ id: string; text: string }>;
}

export function LocationPicker({
  onLocationSelect,
  className,
  height = '400px',
  showSearch = true,
}: LocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);

  // Check for Mapbox token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!mapboxToken && typeof window !== 'undefined') {
    console.warn('Mapbox token is not configured. Map functionality will be limited.');
  }

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
        style: 'mapbox://styles/mapbox/streets-v12',
        center: UK_DEFAULT_CENTER,
        zoom: UK_DEFAULT_ZOOM,
      });

      // Add navigation controls
      initializedMap.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );

      // Add geolocate control
      initializedMap.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: false,
          showUserHeading: false,
        }),
        'top-right'
      );

      // Handle map load
      initializedMap.on('load', () => {
        setIsLoaded(true);
      });

      // Handle map errors
      initializedMap.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map. Please check your Mapbox configuration.');
      });

      // Handle map click
      initializedMap.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        updateMarker(lng, lat);
        reverseGeocode(lng, lat);
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
  }, [mapboxToken]);

  // Update marker position
  const updateMarker = useCallback((lng: number, lat: number) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      marker.current = new mapboxgl.Marker({
        color: '#3b82f6',
        draggable: true,
      })
        .setLngLat([lng, lat])
        .addTo(map.current);

      // Handle marker drag end
      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        reverseGeocode(lngLat.lng, lngLat.lat);
      });
    }
  }, []);

  // Search for location
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use Mapbox Geocoding API with UK bias
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxgl.accessToken}&` +
        `country=gb&` + // Focus on UK
        `types=place,postcode,address,neighborhood,locality&` +
        `limit=5`
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.features || []);
      setShowResults(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Reverse geocode
  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
        `access_token=${mapboxgl.accessToken}&` +
        `types=place,postcode,address,neighborhood,locality&` +
        `limit=1`
      );

      if (!response.ok) throw new Error('Reverse geocoding failed');

      const data = await response.json();
      const feature = data.features?.[0];

      if (feature) {
        const location: GeocodingResult = {
          id: feature.id,
          place_name: feature.place_name,
          center: feature.center,
          context: feature.context,
        };
        setSelectedLocation(location);
        setSearchQuery(feature.place_name);
        onLocationSelect?.({ lng, lat }, feature.place_name);
      } else {
        setSelectedLocation(null);
        onLocationSelect?.({ lng, lat });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      onLocationSelect?.({ lng, lat });
    }
  }, [onLocationSelect]);

  // Select a search result
  const selectResult = useCallback((result: GeocodingResult) => {
    if (!map.current) return;

    const [lng, lat] = result.center;
    
    // Fly to location
    map.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      essential: true,
    });

    // Update marker
    updateMarker(lng, lat);

    // Update state
    setSelectedLocation(result);
    setSearchQuery(result.place_name);
    setShowResults(false);
    
    onLocationSelect?.({ lng, lat }, result.place_name);
  }, [onLocationSelect, updateMarker]);

  // Use current location
  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            essential: true,
          });
        }
        
        updateMarker(longitude, latitude);
        reverseGeocode(longitude, latitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [updateMarker, reverseGeocode]);

  // Handle search input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim()) {
      // Debounce search
      const timeoutId = setTimeout(() => {
        searchLocation(e.target.value);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-border', className)}>
      {/* Search Bar */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  placeholder="Search for a location in UK..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-sm border border-border shadow-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
              </div>
              <button
                onClick={useCurrentLocation}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-card/95 backdrop-blur-sm border border-border shadow-lg hover:bg-accent transition-colors"
                title="Use my current location"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => selectResult(result)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
                  >
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{result.place_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {showResults && !isSearching && searchResults.length === 0 && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">No locations found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Location Badge */}
      {selectedLocation && (
        <div className="absolute bottom-4 left-4 z-10 max-w-sm">
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{selectedLocation.place_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click on map to adjust position
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapContainer}
        className="w-full"
        style={{ height }}
      />

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
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {isLoaded && !selectedLocation && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-card/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg border border-border max-w-xs">
            <p className="text-sm text-muted-foreground">
              Search for a location or click on the map to select where your territory is located.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
