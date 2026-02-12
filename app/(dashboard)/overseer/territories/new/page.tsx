'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BoundaryEditor } from '@/app/components/map/BoundaryEditor';
import { LocationPicker } from '@/app/components/map/LocationPicker';
import { useAuth } from '@/app/hooks/useAuth';
import { useTerritories } from '@/app/hooks/useRxDB';
import { generateId, getTerritoryCenter } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { ArrowLeft, Save, MapPin, AlertCircle, Check } from 'lucide-react';
import Link from 'next/link';

type Step = 'location' | 'boundary';

export default function NewTerritoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addTerritory } = useTerritories(user?.congregation_id);
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boundary, setBoundary] = useState<number[][][] | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lng: number; lat: number; address?: string } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lng: number; lat: number } | undefined>(undefined);

  const handleLocationSelect = useCallback((lngLat: { lng: number; lat: number }, address?: string) => {
    setSelectedLocation({ ...lngLat, address });
    // If address is provided and name is empty, suggest it as territory name
    if (address && !name) {
      // Extract a nice name from the address (first part before comma)
      const suggestedName = address.split(',')[0].trim();
      if (suggestedName) {
        setName(suggestedName);
      }
    }
  }, [name]);

  const handleContinueToBoundary = () => {
    if (!selectedLocation) {
      setError('Please select a location first');
      return;
    }
    setMapCenter(selectedLocation);
    setCurrentStep('boundary');
    setError('');
  };

  const handleBoundaryChange = useCallback((newBoundary: number[][][] | null, valid: boolean) => {
    setBoundary(newBoundary);
    setIsValid(valid);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a territory name');
      triggerHaptic(hapticPatterns.error);
      return;
    }

    if (!boundary || !isValid) {
      setError('Please draw a valid territory boundary');
      triggerHaptic(hapticPatterns.error);
      return;
    }

    if (!user?.congregation_id) {
      setError('You must be part of a congregation to create territories');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const center = getTerritoryCenter(boundary);
      
      const newTerritory = {
        id: generateId(),
        name: name.trim(),
        description: description.trim(),
        congregation_id: user.congregation_id,
        boundary: {
          type: 'Polygon' as const,
          coordinates: boundary,
        },
        center,
        status: 'in-stock' as const,
        color: '#3b82f6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id,
      };

      await addTerritory(newTerritory);
      triggerHaptic(hapticPatterns.success);
      
      router.push('/overseer');
    } catch (err) {
      setError('Failed to save territory. Please try again.');
      triggerHaptic(hapticPatterns.error);
      logger.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/overseer"
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create New Territory</h1>
          <p className="text-muted-foreground">
            {currentStep === 'location' 
              ? 'First, find the location for your territory' 
              : 'Now, draw the boundary around the territory'}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
            currentStep === 'location' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-green-500 text-white'
          )}>
            {currentStep === 'location' ? '1' : <Check className="w-4 h-4" />}
          </div>
          <span className={cn(
            'text-sm font-medium',
            currentStep === 'location' ? 'text-foreground' : 'text-muted-foreground'
          )}>
            Find Location
          </span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
            currentStep === 'boundary' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          )}>
            2
          </div>
          <span className={cn(
            'text-sm font-medium',
            currentStep === 'boundary' ? 'text-foreground' : 'text-muted-foreground'
          )}>
            Draw Boundary
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card p-5 rounded-xl border border-border space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Territory Name *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Oak Street North"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any helpful notes about this territory..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
              />
            </div>

            {currentStep === 'location' && (
              <div className="pt-4 border-t border-border">
                <button
                  onClick={handleContinueToBoundary}
                  disabled={!selectedLocation}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue to Draw Boundary
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
                {!selectedLocation && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Select a location on the map to continue
                  </p>
                )}
              </div>
            )}

            {currentStep === 'boundary' && (
              <div className="pt-4 border-t border-border space-y-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isValid || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Territory
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCurrentStep('location')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Location
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 p-5 rounded-xl border border-border">
            {currentStep === 'location' ? (
              <>
                <h3 className="font-medium mb-2">How to find a location:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Type an address or postcode in the search box</li>
                  <li>Select a result from the dropdown</li>
                  <li>Or click directly on the map</li>
                  <li>Use the target button to use your current location</li>
                </ol>
              </>
            ) : (
              <>
                <h3 className="font-medium mb-2">How to draw a boundary:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Click the polygon button (top-left of map)</li>
                  <li>Click on the map to start drawing</li>
                  <li>Click at each corner of the territory</li>
                  <li>Click the first point to close the shape</li>
                  <li>Drag points to adjust if needed</li>
                </ol>
              </>
            )}
          </div>
        </div>

        {/* Map Editor */}
        <div className="lg:col-span-2">
          {currentStep === 'location' ? (
            <LocationPicker
              onLocationSelect={handleLocationSelect}
              height="600px"
              showSearch={true}
            />
          ) : (
            <BoundaryEditor
              onChange={handleBoundaryChange}
              center={mapCenter}
              height="600px"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// cn helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
