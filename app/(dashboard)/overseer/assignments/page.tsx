'use client';

import { useState, useMemo, memo } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { useAssignments, useTerritories, useSync } from '@/app/hooks/useRxDB';
import { QRCodeGenerator } from '@/app/components/territory/QRCodeGenerator';
import { generateId, formatRelativeTime } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Search,
  RotateCcw,
  UserPlus,
  X,
  Loader2
} from 'lucide-react';

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { assignments, isLoading: assignmentsLoading, addAssignment, updateAssignment } = useAssignments(user?.congregation_id);
  const { territories } = useTerritories(user?.congregation_id);
  const { sync } = useSync(user?.congregation_id);
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<string>('');
  const [publisherName, setPublisherName] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enrich assignments with territory data
  const enrichedAssignments = useMemo(() => {
    return assignments.map(assignment => {
      const territory = territories.find(t => t.id === assignment.territory_id);
      return {
        ...assignment,
        territoryName: territory?.name || 'Unknown Territory',
        territoryDescription: territory?.description,
      };
    });
  }, [assignments, territories]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return enrichedAssignments.filter((a) => {
      const matchesFilter = filter === 'all' || a.status === filter;
      const matchesSearch = 
        a.territoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.publisher_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [enrichedAssignments, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      active: enrichedAssignments.filter((a) => a.status === 'active').length,
      overdue: enrichedAssignments.filter((a) => a.status === 'overdue').length,
      returned: enrichedAssignments.filter((a) => a.status === 'returned').length,
      available: territories.filter(t => t.status === 'in-stock').length,
    };
  }, [enrichedAssignments, territories]);

  // Calculate default due date (14 days from now)
  const getDefaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  // Open assign modal
  const openAssignModal = () => {
    setDueDate(getDefaultDueDate());
    setShowAssignModal(true);
  };

  // Close assign modal
  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedTerritory('');
    setPublisherName('');
    setPublisherId('');
    setDueDate('');
  };

  // Handle manual assignment
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerritory || !publisherName || !user?.congregation_id) return;

    setIsSubmitting(true);
    try {
      const newAssignment = {
        id: generateId(),
        territory_id: selectedTerritory,
        publisher_id: publisherId || generateId(), // Generate if not provided
        publisher_name: publisherName,
        congregation_id: user.congregation_id,
        checked_out_at: new Date().toISOString(),
        checked_out_by: user.id,
        due_date: new Date(dueDate).toISOString(),
        status: 'active' as const,
        qr_token: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addAssignment(newAssignment);
      await sync();
      triggerHaptic(hapticPatterns.success);
      closeAssignModal();
    } catch (err) {
      logger.error('Failed to create assignment:', err);
      triggerHaptic(hapticPatterns.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle return territory
  const handleReturn = async (assignmentId: string) => {
    try {
      await updateAssignment(assignmentId, {
        status: 'returned',
        returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await sync();
      triggerHaptic(hapticPatterns.success);
    } catch (err) {
      logger.error('Failed to return assignment:', err);
      triggerHaptic(hapticPatterns.error);
    }
  };

  const isLoading = assignmentsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Assignments</h1>
          <p className="text-muted-foreground">
            Track territory checkouts and returns
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAssignModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Assign Territory
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          value={stats.active} 
          label="Active" 
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          color="bg-green-500/10 text-green-500"
        />
        <StatCard 
          value={stats.overdue} 
          label="Overdue" 
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          color="bg-red-500/10 text-red-500"
        />
        <StatCard 
          value={stats.returned} 
          label="Returned" 
          icon={<RotateCcw className="w-5 h-5 text-gray-500" />}
          color="bg-gray-500/10 text-gray-500"
        />
        <StatCard 
          value={stats.available} 
          label="Available" 
          icon={<MapPin className="w-5 h-5 text-blue-500" />}
          color="bg-blue-500/10 text-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by territory or publisher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {(['all', 'active', 'overdue', 'returned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium capitalize transition-colors whitespace-nowrap min-h-[44px] ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border text-sm font-medium text-muted-foreground bg-muted/50">
          <div className="col-span-3">Territory</div>
          <div className="col-span-3">Publisher</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading assignments...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <EmptyState onAssignClick={openAssignModal} />
          ) : (
            filteredAssignments.map((assignment) => (
              <AssignmentRow 
                key={assignment.id} 
                assignment={assignment} 
                onReturn={() => handleReturn(assignment.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold">Assign Territory</h3>
                <p className="text-sm text-muted-foreground">Assign a territory to a publisher</p>
              </div>
              <button
                onClick={closeAssignModal}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              {/* Territory Select */}
              <div>
                <label className="block text-sm font-medium mb-2">Territory</label>
                <select
                  value={selectedTerritory}
                  onChange={(e) => setSelectedTerritory(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background"
                >
                  <option value="">Select a territory</option>
                  {territories
                    .filter(t => t.status === 'in-stock')
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                {territories.filter(t => t.status === 'in-stock').length === 0 && (
                  <p className="text-sm text-destructive mt-2">
                    No available territories. All are checked out.
                  </p>
                )}
              </div>

              {/* Publisher Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Publisher Name</label>
                <input
                  type="text"
                  value={publisherName}
                  onChange={(e) => setPublisherName(e.target.value)}
                  placeholder="Enter publisher name"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedTerritory || !publisherName}
                  className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Assign'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  value, 
  label, 
  icon,
  color
}: { 
  value: number; 
  label: string; 
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border flex items-center gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface AssignmentRowProps {
  assignment: {
    id: string;
    territory_id: string;
    territoryName: string;
    territoryDescription?: string;
    publisher_name: string;
    publisher_id: string;
    checked_out_at: string;
    due_date?: string;
    status: 'active' | 'returned' | 'overdue';
    returned_at?: string;
  };
  onReturn: () => void;
}

function AssignmentRow({ assignment, onReturn }: AssignmentRowProps) {
  const statusColors = {
    active: 'bg-green-500/10 text-green-500',
    overdue: 'bg-red-500/10 text-red-500',
    returned: 'bg-gray-500/10 text-gray-500',
  };

  const isOverdue = assignment.status === 'overdue';
  const isActive = assignment.status === 'active';

  return (
    <div className="p-4 md:grid md:grid-cols-12 md:gap-4 items-center hover:bg-accent/50 transition-colors">
      {/* Territory */}
      <div className="md:col-span-3 mb-2 md:mb-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{assignment.territoryName}</p>
            {assignment.territoryDescription && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {assignment.territoryDescription}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Publisher */}
      <div className="md:col-span-3 mb-2 md:mb-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
            {assignment.publisher_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium">{assignment.publisher_name}</p>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(assignment.checked_out_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Due Date */}
      <div className="md:col-span-2 mb-2 md:mb-0">
        <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
          <Calendar className="w-4 h-4" />
          <span className="text-sm">
            {assignment.due_date 
              ? new Date(assignment.due_date).toLocaleDateString()
              : 'No due date'
            }
          </span>
        </div>
        {isOverdue && assignment.due_date && (
          <OverdueDays dueDate={assignment.due_date} />
        )}
      </div>

      {/* Status */}
      <div className="md:col-span-2 mb-2 md:mb-0">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[assignment.status]}`}>
          {assignment.status}
        </span>
      </div>

      {/* Actions */}
      <div className="md:col-span-2 flex items-center gap-2">
        {isActive && (
          <>
            <QRCodeGenerator 
              territoryId={assignment.territory_id}
              territoryName={assignment.territoryName}
            />
            <button
              onClick={onReturn}
              className="p-2 hover:bg-accent rounded-lg transition-colors text-green-500"
              title="Mark as returned"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </>
        )}
        {assignment.status === 'returned' && assignment.returned_at && (
          <span className="text-sm text-muted-foreground">
            Returned {formatRelativeTime(assignment.returned_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// Client component that calculates days overdue
const OverdueDays = memo(function OverdueDays({ dueDate }: { dueDate: string }) {
  const [daysOverdue] = useState(() => {
    return Math.ceil((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
  });

  return (
    <p className="text-xs text-red-500 mt-1">
      {daysOverdue} days overdue
    </p>
  );
});

function EmptyState({ onAssignClick }: { onAssignClick: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
        <UserPlus className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No assignments found</h3>
      <p className="text-muted-foreground mb-6">
        Assign territories to publishers to start tracking them.
      </p>
      <button
        onClick={onAssignClick}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        <UserPlus className="w-5 h-5" />
        Assign Territory
      </button>
    </div>
  );
}
