'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { useHouses, useAssignments, useTerritories } from '@/app/hooks/useRxDB';
import { MapContainer } from '@/app/components/map/MapContainer';
import { 
  MapPin, 
  Clock, 
  Home,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';

export default function PublisherPage() {
  const { user } = useAuth();
  
  // Get active assignment
  const { assignments, isLoading: assignmentsLoading } = useAssignments(user?.congregation_id);
  const { territories } = useTerritories(user?.congregation_id);
  
  const activeAssignment = useMemo(() => {
    return assignments.find(
      (a) => a.publisher_id === user?.id && a.status === 'active'
    );
  }, [assignments, user?.id]);

  const territory = useMemo(() => {
    if (!activeAssignment) return null;
    return territories.find(t => t.id === activeAssignment.territory_id);
  }, [activeAssignment, territories]);

  const territoryId = activeAssignment?.territory_id;

  // Get houses for this territory
  const { houses, isLoading: housesLoading } = useHouses(territoryId, user?.congregation_id);

  // Calculate stats
  const stats = useMemo(() => {
    const all = houses;
    const total = all.length;
    const visited = all.filter(h => h.status !== 'not-visited').length;
    const notAtHome = all.filter(h => h.status === 'nah').length;
    const interest = all.filter(h => h.status === 'interest').length;
    const returnVisits = all.filter(h => h.status === 'return-visit').length;
    const dnc = all.filter(h => h.is_dnc).length;
    
    return {
      total,
      visited,
      notVisited: total - visited,
      notAtHome,
      interest,
      returnVisits,
      dnc,
      completion: total > 0 ? Math.round((visited / total) * 100) : 0,
    };
  }, [houses]);

  // Get return visits (sorted by date)
  const returnVisitHouses = useMemo(() => {
    return houses
      .filter(h => h.status === 'return-visit' || h.return_visit_date)
      .sort((a, b) => {
        // Sort by return visit date (earliest first)
        const dateA = a.return_visit_date ? new Date(a.return_visit_date).getTime() : Infinity;
        const dateB = b.return_visit_date ? new Date(b.return_visit_date).getTime() : Infinity;
        return dateA - dateB;
      })
      .slice(0, 5); // Show top 5
  }, [houses]);

  const isLoading = assignmentsLoading || housesLoading;

  // No active assignment state
  if (!isLoading && !activeAssignment) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Active Territory</h2>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have any territory checked out. Scan a QR code from your territory overseer to get started.
          </p>
          <div className="text-sm text-muted-foreground">
            <p>Ask your overseer for a territory QR code,</p>
            <p>then scan it with your camera app.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Territory</h1>
        <p className="text-muted-foreground">
          View and manage your assigned territories
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Current Assignment */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary font-medium mb-2">
                  <MapPin className="w-5 h-5" />
                  Currently Assigned
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {territory?.name || 'Unknown Territory'}
                </h2>
                {activeAssignment?.due_date && (
                  <p className="text-muted-foreground">
                    Due: {new Date(activeAssignment.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Link
                href="/publisher/territory"
                className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Open Map
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-card rounded-lg p-4">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Houses</p>
              </div>
              <div className="bg-card rounded-lg p-4">
                <p className="text-2xl font-bold">{stats.visited}</p>
                <p className="text-sm text-muted-foreground">Visited</p>
              </div>
              <div className="bg-card rounded-lg p-4">
                <p className="text-2xl font-bold">{stats.completion}%</p>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Home className="w-5 h-5" />}
              label="Not Visited"
              value={stats.notVisited}
              color="text-gray-500"
            />
            <StatCard
              icon={<AlertCircle className="w-5 h-5" />}
              label="Not at Home"
              value={stats.notAtHome}
              color="text-amber-500"
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="Interest"
              value={stats.interest}
              color="text-green-500"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Return Visits"
              value={stats.returnVisits}
              color="text-purple-500"
            />
          </div>

          {/* Map Preview */}
          <div className="h-[300px] rounded-xl overflow-hidden border border-border">
            <MapContainer />
          </div>

          {/* Return Visit Reminders */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Return Visit Reminders</h2>
              <Link 
                href="/publisher/return-visits"
                className="text-sm text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            
            {returnVisitHouses.length > 0 ? (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {returnVisitHouses.map((house) => (
                    <ReturnVisitItem
                      key={house.id}
                      address={house.address}
                      notes={house.notes}
                      date={house.return_visit_date}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-xl p-6 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No return visits scheduled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Mark houses as &quot;Return Visit&quot; to see them here
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value,
  color
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ReturnVisitItem({ 
  address, 
  notes,
  date,
}: { 
  address: string; 
  notes?: string;
  date?: string;
}) {
  const getDateLabel = () => {
    if (!date) return 'No date set';
    const d = new Date(date);
    const now = new Date();
    
    if (d < now) {
      const days = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} day${days > 1 ? 's' : ''} overdue`;
    }
    if (d.toDateString() === now.toDateString()) return 'Today';
    
    return d.toLocaleDateString();
  };

  const isOverdue = date ? new Date(date) < new Date() : false;

  return (
    <div className="flex items-start justify-between p-4 hover:bg-accent/50 transition-colors">
      <div>
        <p className="font-medium">{address}</p>
        {notes && (
          <p className="text-sm text-muted-foreground mt-1">{notes}</p>
        )}
      </div>
      <div className={`text-right text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-primary'}`}>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {getDateLabel()}
        </div>
      </div>
    </div>
  );
}
