'use client';

import { useEffect, useState } from 'react';
import { MapPin, WifiOff, RefreshCw, Database, AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/app/lib/utils/logger';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get last sync time from localStorage
    const stored = localStorage.getItem('last-sync-time');
    if (stored) {
      setLastSynced(stored);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    // Try to reload the page
    try {
      // Check if service worker is registered and has cached content
      const registration = await navigator.serviceWorker?.ready;
      
      if (registration) {
        // Try to sync if online
        if (navigator.onLine) {
          // Trigger background sync if available
          if ('sync' in registration && 'sync' in registration) {
            const swRegistration = registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } };
            await swRegistration.sync.register('sync-territories');
          }
          
          // Reload to the home page
          window.location.href = '/';
        } else {
          // Still offline, show toast or notification
          alert('Still offline. Please check your connection.');
        }
      } else {
        // No service worker, just reload
        window.location.reload();
      }
    } catch (error) {
      logger.error('Error retrying:', error);
      window.location.reload();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <MapPin className="w-6 h-6 text-primary" />
            <span>Territory Mapper</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Status Card */}
          <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
            {/* Icon Section */}
            <div className="bg-muted/50 p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-background rounded-full flex items-center justify-center shadow-inner">
                {isOnline ? (
                  <RefreshCw className="w-12 h-12 text-green-500 animate-spin" />
                ) : (
                  <WifiOff className="w-12 h-12 text-amber-500" />
                )}
              </div>
              <h1 className="text-2xl font-bold mb-2">
                {isOnline ? 'Reconnecting...' : 'You\'re Offline'}
              </h1>
              <p className="text-muted-foreground">
                {isOnline 
                  ? 'Connection restored. Redirecting you...' 
                  : 'No internet connection available'
                }
              </p>
            </div>

            {/* Info Section */}
            <div className="p-6 space-y-4">
              {/* Offline Capabilities */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Offline Mode Active</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data is stored locally. You can continue working and sync when back online.
                  </p>
                </div>
              </div>

              {/* Last Sync */}
              {lastSynced && (
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Last Synced</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(lastSynced).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* What You Can Do */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Available Offline
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    View downloaded territories
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Record house visits
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Add voice notes
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    View return visit list
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      {isOnline ? 'Go to Dashboard' : 'Try Again'}
                    </>
                  )}
                </button>

                <Link
                  href="/"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-medium hover:bg-accent transition-colors"
                >
                  <Home className="w-5 h-5" />
                  Continue Offline
                </Link>
              </div>

              {/* Help Text */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Some features require an internet connection. Changes made offline will sync automatically when you reconnect.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Territory Mapper • Offline-First Design
          </p>
        </div>
      </main>
    </div>
  );
}
