/**
 * Performance Monitoring Hook
 * 
 * Tracks Core Web Vitals and performance metrics
 */

import { useEffect, useCallback, useState } from 'react';

interface PerformanceMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

export function usePerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if PerformanceObserver is supported
    if (!('PerformanceObserver' in window)) {
      console.warn('[Performance] PerformanceObserver not supported');
      return;
    }

    const observers: PerformanceObserver[] = [];

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        setMetrics((prev) => ({ ...prev, LCP: lastEntry.startTime }));
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      observers.push(lcpObserver);
    } catch {
      console.warn('[Performance] LCP not supported');
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEntry & { processingStart: number; startTime: number };
          setMetrics((prev) => ({ ...prev, FID: fidEntry.processingStart - fidEntry.startTime }));
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      observers.push(fidObserver);
    } catch {
      console.warn('[Performance] FID not supported');
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          // Type guard for layout shift entries
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value: number };
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        });
        setMetrics((prev) => ({ ...prev, CLS: clsValue }));
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      observers.push(clsObserver);
    } catch {
      console.warn('[Performance] CLS not supported');
    }

    // First Contentful Paint
    try {
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            setMetrics((prev) => ({ ...prev, FCP: entry.startTime }));
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      observers.push(paintObserver);
    } catch {
      console.warn('[Performance] Paint not supported');
    }

    // Time to First Byte - schedule state update for next tick to avoid sync setState
    const scheduleTTFBUpdate = () => {
      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const navEntry = navigationEntries[0] as PerformanceNavigationTiming;
        return navEntry.responseStart - navEntry.startTime;
      }
      return undefined;
    };

    const ttfb = scheduleTTFBUpdate();
    if (ttfb !== undefined) {
      // Use requestAnimationFrame to avoid synchronous setState
      requestAnimationFrame(() => {
        setMetrics((prev) => ({ ...prev, TTFB: ttfb }));
      });
    }

    setIsReady(true);

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  // Report metrics to analytics
  const reportMetrics = useCallback(() => {
    if (Object.keys(metrics).length === 0) return;

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Performance] Metrics:', metrics);
    }

    // Send to analytics endpoint
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const data = JSON.stringify({
        metrics,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      navigator.sendBeacon('/api/analytics/performance', data);
    }
  }, [metrics]);

  // Report when page unloads
  useEffect(() => {
    window.addEventListener('beforeunload', reportMetrics);
    return () => window.removeEventListener('beforeunload', reportMetrics);
  }, [reportMetrics]);

  // Get performance rating
  const getRating = useCallback((metric: keyof PerformanceMetrics) => {
    const value = metrics[metric];
    if (value === undefined) return 'unknown';

    switch (metric) {
      case 'LCP':
        return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      case 'FID':
        return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
      case 'CLS':
        return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
      case 'FCP':
        return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
      case 'TTFB':
        return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
      default:
        return 'unknown';
    }
  }, [metrics]);

  return {
    metrics,
    isReady,
    reportMetrics,
    getRating,
  };
}

// Measure component render time
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development' && duration > 16) {
        console.warn(`[Performance] ${componentName} took ${duration.toFixed(2)}ms to render`);
      }
    };
  }, [componentName]);
}

// Lazy load with preload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLazyPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const [component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (component || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedModule = await factory();
      setComponent(() => loadedModule.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setIsLoading(false);
    }
  }, [factory, component, isLoading]);

  const preload = useCallback(() => {
    // Preload on hover/ interaction
    if (!component && !isLoading) {
      load();
    }
  }, [component, isLoading, load]);

  return {
    component,
    isLoading,
    error,
    load,
    preload,
  };
}

// Optimize images
export function useOptimizedImage(src: string, _options: { width?: number; quality?: number } = {}) {
  const [optimizedSrc, setOptimizedSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    // Check if browser supports native lazy loading
    const img = new Image();
    
    img.onload = () => {
      if (isMounted) {
        setIsLoading(false);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setIsLoading(false);
      }
    };

    // Use loading="lazy" for below-fold images
    if ('loading' in HTMLImageElement.prototype) {
      img.loading = 'lazy';
    }

    img.src = src;
    setOptimizedSrc(src);

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { src: optimizedSrc, isLoading };
}
