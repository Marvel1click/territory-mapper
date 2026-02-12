/**
 * Dynamic Imports for Code Splitting
 * 
 * This file exports lazy-loaded versions of heavy components
 * to enable code splitting and improve initial load time.
 */

import { lazy, Suspense, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Loading fallback component
function LoadingFallback({ message = 'Loading...' }: { message?: string }): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Create lazy component with suspense wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLazyComponent<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallbackMessage?: string
) {
  const LazyComponent = lazy(factory);
  
  return function WrappedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<LoadingFallback message={fallbackMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy load Mapbox components (heavy)
export const LazyMapContainer = createLazyComponent(
  () => import('@/app/components/map/MapContainer').then(m => ({ default: m.MapContainer })),
  'Loading map...'
);

export const LazyBoundaryEditor = createLazyComponent(
  () => import('@/app/components/map/BoundaryEditor').then(m => ({ default: m.BoundaryEditor })),
  'Loading map editor...'
);

// Lazy load territory components
export const LazyTerritoryCard = createLazyComponent(
  () => import('@/app/components/territory/TerritoryCard').then(m => ({ default: m.TerritoryCard })),
  'Loading...'
);

export const LazyQRCodeGenerator = createLazyComponent(
  () => import('@/app/components/territory/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator })),
  'Loading QR code...'
);

export const LazyHouseImport = createLazyComponent(
  () => import('@/app/components/territory/HouseImport').then(m => ({ default: m.HouseImport })),
  'Loading import tool...'
);

// Lazy load accessibility components
export const LazyAccessibilitySettings = createLazyComponent(
  () => import('@/app/components/accessibility/AccessibilitySettings').then(m => ({ default: m.AccessibilitySettings })),
  'Loading settings...'
);

// Preload functions for eager loading on interaction
export const preloadMapContainer = () => {
  import('@/app/components/map/MapContainer');
};

export const preloadBoundaryEditor = () => {
  import('@/app/components/map/BoundaryEditor');
};

export const preloadQRCodeGenerator = () => {
  import('@/app/components/territory/QRCodeGenerator');
};

// Route-based preloading
export function useRoutePreload() {
  const preloadOverseer = () => {
    import('@/app/(dashboard)/overseer/page');
    preloadMapContainer();
  };

  const preloadPublisher = () => {
    import('@/app/(dashboard)/publisher/page');
    preloadMapContainer();
  };

  const preloadTerritoryDetail = () => {
    import('@/app/(dashboard)/overseer/territories/[id]/page');
    preloadMapContainer();
    preloadQRCodeGenerator();
  };

  return {
    preloadOverseer,
    preloadPublisher,
    preloadTerritoryDetail,
  };
}
