'use client';

import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';
import { useTerritories, useHouses, useAssignments, useSync } from '@/app/hooks/useRxDB';
import { MapContainer } from '@/app/components/map/MapContainer';
import { TerritoryCard } from '@/app/components/territory/TerritoryCard';
import { Plus, MapPin, Search, Grid3X3, List, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

export default function OverseerPage() {
  const { user } = useAuth();
  const { territories, isLoading: territoriesLoading, deleteTerritory } = useTerritories(user?.congregation_id);
  const { houses } = useHouses(undefined, user?.congregation_id); // Get all houses for congregation
  const { assignments } = useAssignments(user?.congregation_id);
  const { sync } = useSync(user?.congregation_id);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-stock' | 'out' | 'pending'>('all');
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

  // Filter territories
  const filteredTerritories = useMemo(() => {
    return territories.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [territories, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const all = territories;
    return {
      total: all.length,
      inStock: all.filter((t) => t.status === 'in-stock').length,
      out: all.filter((t) => t.status === 'out').length,
      pending: all.filter((t) => t.status === 'pending').length,
    };
  }, [territories]);

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

  const isLoading = territoriesLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Territories</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Manage and assign congregation territories
          </p>
        </div>
        <Link
          href="/overseer/territories/new"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md min-h-[48px]"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          New Territory
        </Link>
      </div>

      {/* Welcome Banner for New Users */}
      {!isLoading && stats.total === 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="p-3 sm:p-4 bg-primary/10 rounded-2xl flex-shrink-0">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-2">Welcome to Territory Mapper!</h2>
                <p className="text-muted-foreground max-w-lg text-base">
                  Get started by following our step-by-step guide to set up your congregation&apos;s territories.
                </p>
              </div>
            </div>
            <Link
              href="/overseer/getting-started"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors whitespace-nowrap shadow-sm hover:shadow-md min-h-[48px]"
            >
              Get Started
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Total" value={stats.total} color="bg-blue-500" iconColor="text-blue-500" />
        <StatCard label="In Stock" value={stats.inStock} color="bg-green-500" iconColor="text-green-500" />
        <StatCard label="Checked Out" value={stats.out} color="bg-amber-500" iconColor="text-amber-500" />
        <StatCard label="Pending" value={stats.pending} color="bg-purple-500" iconColor="text-purple-500" />
      </div>

      {/* Map Preview */}
      <div className="h-[300px] sm:h-[350px] rounded-2xl overflow-hidden border border-border shadow-sm">
        <MapContainer />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search territories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[48px]"
            aria-label="Search territories"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'in-stock' | 'out' | 'pending')}
            className="px-4 py-3 rounded-xl border border-input bg-background min-h-[48px] focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="out">Checked Out</option>
            <option value="pending">Pending</option>
          </select>

          <div className="flex items-center border border-input rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3X3 className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Territories List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 sm:h-80">
          <Loader2 className="w-12 h-12 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Loading territories...</span>
        </div>
      ) : filteredTerritories.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6' : 'space-y-4'}>
          {filteredTerritories.map((territory) => (
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
      )}
    </div>
  );
}

function StatCard({ label, value, color, iconColor }: { label: string; value: number; color: string; iconColor: string }) {
  return (
    <div className="bg-card p-4 sm:p-5 rounded-xl border border-border flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl ${color}/20 flex items-center justify-center flex-shrink-0`}>
        <MapPin className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-16 sm:py-20 bg-card rounded-2xl border border-border shadow-sm">
      <div className="w-20 h-20 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
        <MapPin className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold mb-3">
        {searchQuery ? 'No territories found' : 'No territories yet'}
      </h3>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto px-4">
        {searchQuery
          ? `No territories match "${searchQuery}". Try a different search.`
          : 'Create your first territory to get started with territory management.'}
      </p>
      {!searchQuery && (
        <Link
          href="/overseer/territories/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md min-h-[48px]"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          Create Territory
        </Link>
      )}
    </div>
  );
}
