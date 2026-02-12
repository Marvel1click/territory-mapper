'use client';

import Link from 'next/link';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { QRCodeGenerator } from './QRCodeGenerator';
import { cn, formatRelativeTime } from '@/app/lib/utils';
import { 
  MapPin, 
  Users, 
  Clock,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface TerritoryCardProps {
  id: string;
  name: string;
  description?: string;
  status: 'in-stock' | 'out' | 'pending';
  housesCount: number;
  lastWorked?: string;
  assignedTo?: string;
  dueDate?: string;
  className?: string;
  onDelete?: (id: string) => void;
}

export function TerritoryCard({
  id,
  name,
  description,
  status,
  housesCount,
  lastWorked,
  assignedTo,
  dueDate,
  className,
  onDelete,
}: TerritoryCardProps) {
  const { triggerHaptic, hapticPatterns } = useAccessibility();

  const statusConfig = {
    'in-stock': {
      label: 'In Stock',
      className: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
      icon: CheckCircle2,
    },
    'out': {
      label: 'Checked Out',
      className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: AlertCircle,
    },
    'pending': {
      label: 'Pending',
      className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
      icon: Clock,
    },
  };

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      onDelete?.(id);
      triggerHaptic(hapticPatterns.warning);
    }
  };

  return (
    <div
      className={cn(
        'group bg-card rounded-2xl border border-border overflow-hidden',
        'hover:shadow-lg hover:border-primary/20 transition-all duration-200',
        className
      )}
    >
      {/* Card Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-primary/10 rounded-xl flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">{name}</h3>
              {description && (
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              )}
            </div>
          </div>
          
          {/* Status Badge */}
          <span
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border flex-shrink-0',
              statusInfo.className
            )}
          >
            <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {statusInfo.label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" aria-hidden="true" />
            {housesCount} houses
          </span>
          {lastWorked && (
            <span className="flex items-center gap-1.5 truncate">
              <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">
                {status === 'out' && assignedTo
                  ? `Assigned to ${assignedTo}`
                  : formatRelativeTime(lastWorked)}
              </span>
            </span>
          )}
        </div>

        {/* Assignment Info */}
        {status === 'out' && dueDate && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
              Due back: {new Date(dueDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/overseer/territories/${id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-muted hover:bg-accent transition-colors text-sm font-medium min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit className="w-4 h-4" aria-hidden="true" />
            Edit
          </Link>
          
          <QRCodeGenerator
            territoryId={id}
            territoryName={name}
          />
          
          <button
            onClick={handleDelete}
            className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-colors min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Delete ${name}`}
            title={`Delete ${name}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Progress Bar (if checked out) */}
      {status === 'out' && (
        <div className="h-1.5 bg-muted">
          <div className="h-full w-3/5 bg-amber-500 rounded-r-full" />
        </div>
      )}
    </div>
  );
}
