'use client';

import { useState, useEffect } from 'react';
import { useSync } from '@/app/hooks/useRxDB';
import { useAuth } from '@/app/hooks/useAuth';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  WifiOff
} from 'lucide-react';
import { useSyncStore } from '@/app/lib/store';
import { cn } from '@/app/lib/utils';

interface SyncStatusProps {
  className?: string;
}

export function SyncStatus({ className }: SyncStatusProps) {
  const { user } = useAuth();
  const { sync, isSyncing, lastSync, error } = useSync(user?.congregation_id);
  const { isOnline, pendingChanges } = useSyncStore();
  const [showDetails, setShowDetails] = useState(false);

  // Auto-hide details after 3 seconds
  useEffect(() => {
    if (showDetails) {
      const timeout = setTimeout(() => setShowDetails(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [showDetails, isSyncing]);

  const handleSync = async () => {
    try {
      await sync();
      setShowDetails(true);
    } catch {
      setShowDetails(true);
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-amber-500" />;
    }
    if (error) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (pendingChanges > 0) {
      return <CloudOff className="w-4 h-4 text-amber-500" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (error) return 'Sync Error';
    if (pendingChanges > 0) return `${pendingChanges} pending`;
    return 'Synced';
  };

  const getStatusColor = () => {
    if (isSyncing) return 'text-blue-500';
    if (!isOnline) return 'text-amber-500';
    if (error) return 'text-red-500';
    if (pendingChanges > 0) return 'text-amber-500';
    return 'text-green-500';
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleSync}
        disabled={isSyncing || !isOnline}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          'bg-muted hover:bg-accent',
          !isOnline && 'opacity-70'
        )}
      >
        {getStatusIcon()}
        <span className={getStatusColor()}>{getStatusText()}</span>
      </button>

      {/* Status Tooltip */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-card border border-border rounded-lg shadow-lg whitespace-nowrap z-50">
          {error ? (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-muted-foreground" />
                <span>Status: {isOnline ? 'Online' : 'Offline'}</span>
              </div>
              {lastSync && (
                <div className="text-muted-foreground">
                  Last sync: {new Date(lastSync).toLocaleTimeString()}
                </div>
              )}
              {pendingChanges > 0 && (
                <div className="text-amber-500">
                  {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} pending
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
