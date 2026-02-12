'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';
import { useHouses, useAssignments } from '@/app/hooks/useRxDB';
import { formatDate, formatRelativeTime } from '@/app/lib/utils';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Calendar,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Home
} from 'lucide-react';

interface ReturnVisitHouse {
  id: string;
  address: string;
  territory_id: string;
  territory_name?: string;
  return_visit_date?: string;
  notes?: string;
  last_visited?: string;
}

export default function ReturnVisitsPage() {
  const { user } = useAuth();
  
  // Get active assignment
  const { assignments } = useAssignments(user?.congregation_id);
  const activeAssignment = useMemo(() => {
    return assignments.find(
      (a) => a.publisher_id === user?.id && a.status === 'active'
    );
  }, [assignments, user?.id]);

  const territoryId = activeAssignment?.territory_id;

  // Get houses
  const { houses, isLoading } = useHouses(territoryId, user?.congregation_id);

  // Filter for return visits
  const returnVisits = useMemo(() => {
    return houses
      .filter((h) => h.status === 'return-visit' || h.return_visit_date)
      .sort((a, b) => {
        // Sort by return visit date (earliest first)
        const dateA = a.return_visit_date ? new Date(a.return_visit_date).getTime() : Infinity;
        const dateB = b.return_visit_date ? new Date(b.return_visit_date).getTime() : Infinity;
        return dateA - dateB;
      })
      .map((h): ReturnVisitHouse => ({
        id: h.id,
        address: h.address,
        territory_id: h.territory_id,
        territory_name: activeAssignment?.territoryName || 'My Territory',
        return_visit_date: h.return_visit_date,
        notes: h.notes,
        last_visited: h.last_visited,
      }));
  }, [houses, activeAssignment?.territoryName]);

  // Group by urgency
  const { overdue, today, upcoming, noDate } = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    return {
      overdue: returnVisits.filter(rv => {
        if (!rv.return_visit_date) return false;
        return new Date(rv.return_visit_date) < now;
      }),
      today: returnVisits.filter(rv => {
        if (!rv.return_visit_date) return false;
        const date = new Date(rv.return_visit_date);
        return date >= now && date <= todayEnd;
      }),
      upcoming: returnVisits.filter(rv => {
        if (!rv.return_visit_date) return false;
        return new Date(rv.return_visit_date) > todayEnd;
      }),
      noDate: returnVisits.filter(rv => !rv.return_visit_date),
    };
  }, [returnVisits]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/publisher"
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Return Visits</h1>
          <p className="text-muted-foreground">
            {returnVisits.length} scheduled return {returnVisits.length === 1 ? 'visit' : 'visits'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard 
          value={overdue.length} 
          label="Overdue" 
          color="text-red-500"
          icon={<AlertCircle className="w-5 h-5" />}
        />
        <StatCard 
          value={today.length} 
          label="Today" 
          color="text-amber-500"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard 
          value={upcoming.length} 
          label="Upcoming" 
          color="text-blue-500"
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard 
          value={noDate.length} 
          label="No Date" 
          color="text-gray-500"
          icon={<Home className="w-5 h-5" />}
        />
      </div>

      {/* Lists */}
      <div className="space-y-6">
        {/* Overdue */}
        {overdue.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              Overdue
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {overdue.map((rv, i) => (
                <ReturnVisitItem key={rv.id} visit={rv} isLast={i === overdue.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* Today */}
        {today.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-amber-500">
              <Clock className="w-5 h-5" />
              Today
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {today.map((rv, i) => (
                <ReturnVisitItem key={rv.id} visit={rv} isLast={i === today.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-500">
              <Calendar className="w-5 h-5" />
              Upcoming
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {upcoming.map((rv, i) => (
                <ReturnVisitItem key={rv.id} visit={rv} isLast={i === upcoming.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* No Date Set */}
        {noDate.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-500">
              <Home className="w-5 h-5" />
              No Date Set
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {noDate.map((rv, i) => (
                <ReturnVisitItem key={rv.id} visit={rv} isLast={i === noDate.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {returnVisits.length === 0 && (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Return Visits</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              You don&apos;t have any scheduled return visits. When you mark a house as &quot;Return Visit&quot;, it will appear here.
            </p>
            <Link
              href="/publisher/territory"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <MapPin className="w-5 h-5" />
              Go to Territory
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat card
function StatCard({ 
  value, 
  label, 
  color,
  icon
}: { 
  value: number; 
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// Return visit item
function ReturnVisitItem({ visit, isLast }: { visit: ReturnVisitHouse; isLast: boolean }) {
  const getUrgencyColor = () => {
    if (!visit.return_visit_date) return 'text-gray-500';
    const date = new Date(visit.return_visit_date);
    const now = new Date();
    if (date < now) return 'text-red-500';
    if (date.toDateString() === now.toDateString()) return 'text-amber-500';
    return 'text-blue-500';
  };

  const getDateLabel = () => {
    if (!visit.return_visit_date) return 'No date set';
    const date = new Date(visit.return_visit_date);
    const now = new Date();
    
    if (date < now) {
      const days = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} day${days > 1 ? 's' : ''} overdue`;
    }
    if (date.toDateString() === now.toDateString()) return 'Today';
    
    return formatDate(visit.return_visit_date);
  };

  return (
    <div className={`p-4 flex items-start justify-between hover:bg-accent/50 transition-colors ${!isLast ? 'border-b border-border' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="font-medium truncate">{visit.address}</p>
        </div>
        
        {visit.notes && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            &ldquo;{visit.notes}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-4 mt-2 text-sm">
          <div className={`flex items-center gap-1.5 ${getUrgencyColor()}`}>
            <Clock className="w-4 h-4" />
            <span className="font-medium">{getDateLabel()}</span>
          </div>
          
          {visit.last_visited && (
            <span className="text-muted-foreground">
              Last: {formatRelativeTime(visit.last_visited)}
            </span>
          )}
        </div>
      </div>

      <Link
        href="/publisher/territory"
        className="ml-4 p-2 hover:bg-accent rounded-lg transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </Link>
    </div>
  );
}
