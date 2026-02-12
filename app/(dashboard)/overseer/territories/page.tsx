'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { useTerritories, useHouses, useAssignments, useSync } from '@/app/hooks/useRxDB';
import { TerritoryCard } from '@/app/components/territory/TerritoryCard';
import { 
  Plus, 
  Search, 
  MapPin, 
  ArrowLeft,
  Grid3X3,
  List
} from 'lucide-react';

export default function TerritoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { territories, isLoading, error, deleteTerritory } = useTerritories(user?.congregation_id);
  const { houses } = useHouses(undefined, user?.congregation_id);
  const { assignments } = useAssignments(user?.congregation_id);
  const { sync } = useSync(user?.congregation_id);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Calculate house counts per territory
  const houseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    houses.forEach(house => {
      counts[house.territory_id] = (counts[house.territory_id] || 0) + 1;
    });
    return counts;
  }, [houses]);

  // Get active assignment info for each territory
  const territoryAssignments = useMemo(() => {
    const assignmentMap: Record<string, { publisherName: string; dueDate: string }> = {};
    assignments
      .filter(a => a.status === 'active')
      .forEach(a => {
        assignmentMap[a.territory_id] = {
          publisherName: a.publisher_name,
          dueDate: a.due_date || '',
        };
      });
    return assignmentMap;
  }, [assignments]);

  // Filter territories based on search
  const filteredTerritories = territories.filter(territory => {
    const matchesSearch = searchQuery === '' || 
      territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (territory.description && territory.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  // Sort by name
  const sortedTerritories = [...filteredTerritories].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Handle territory deletion
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this territory? This will also delete all houses in it.')) {
      return;
    }
    
    setDeletingId(id);
    try {
      await deleteTerritory(id);
      await sync();
    } catch (err) {
      console.error('Failed to delete territory:', err);
      alert('Failed to delete territory. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [deleteTerritory, sync]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/overseer')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Territories
            </h1>
            <p className="text-muted-foreground">
              Manage your congregation&apos;s territories
            </p>
          </div>
        </div>
        
        <Link
          href="/overseer/territories/new"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Territory
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search territories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background"
              aria-label="Search territories"
            />
          </div>
          
          <div className="flex items-center border border-input rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-muted-foreground">
          {isLoading ? (
            'Loading territories...'
          ) : (
            <>Showing {sortedTerritories.length} of {territories.length} territories</>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div 
          className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive"
          role="alert"
        >
          <p className="font-medium">Error loading territories</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Territories Grid/List */}
      {isLoading ? (
        <div className={viewMode === 'grid' 
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' 
          : 'space-y-3'
        }>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6 h-48 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : sortedTerritories.length > 0 ? (
        <div className={viewMode === 'grid' 
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' 
          : 'space-y-3'
        }>
          {sortedTerritories.map(territory => (
            <TerritoryCard
              key={territory.id}
              id={territory.id}
              name={territory.name}
              description={territory.description}
              status={territory.status}
              housesCount={houseCounts[territory.id] || 0}
              lastWorked={territory.updated_at}
              assignedTo={territoryAssignments[territory.id]?.publisherName}
              dueDate={territoryAssignments[territory.id]?.dueDate}
              onDelete={deletingId === territory.id ? undefined : handleDelete}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <MapPin className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No territories found' : 'No territories yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first territory'
            }
          </p>
          {!searchQuery && (
            <Link
              href="/overseer/territories/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Territory
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
