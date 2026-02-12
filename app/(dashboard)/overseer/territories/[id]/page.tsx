"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAuth } from "@/app/hooks/useAuth";
import { useTerritories, useHouses, useSync } from "@/app/hooks/useRxDB";
import { useAccessibility } from "@/app/hooks/useAccessibility";
import { QRCodeGenerator } from "@/app/components/territory/QRCodeGenerator";
import { HouseImport } from "@/app/components/territory/HouseImport";
import { encryptDncAddress } from "@/app/lib/encryption/dnc";
import {
  generateId,
  houseStatusColors,
  houseStatusLabels,
  formatRelativeTime,
} from "@/app/lib/utils";
import type { House } from "@/app/types";
import { logger } from "@/app/lib/utils/logger";
import {
  ArrowLeft,
  Edit2,
  Home,
  Plus,
  Trash2,
  Download,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface TerritoryDetailPageProps {
  params: {
    id: string;
  };
}

export default function TerritoryDetailPage({
  params,
}: TerritoryDetailPageProps) {
  const { user } = useAuth();
  const { sync } = useSync(user?.congregation_id);
  const { triggerHaptic, hapticPatterns, bigMode } = useAccessibility();

  const { territories } = useTerritories(user?.congregation_id);
  const territory = useMemo(() => {
    return territories.find((t) => t.id === params.id);
  }, [territories, params.id]);

  const {
    houses,
    isLoading: _housesLoading,
    bulkAddHouses,
    deleteHouse,
  } = useHouses(params.id, user?.congregation_id);

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "list">("map");

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !territory) return;

    const center = territory.center || [-74.006, 40.7128];

    const initializedMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: 14,
    });

    initializedMap.addControl(new mapboxgl.NavigationControl(), "top-right");

    initializedMap.on("load", () => {
      setIsMapLoaded(true);

      // Add territory boundary if exists
      if (territory.boundary) {
        initializedMap.addSource("territory-boundary", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: territory.boundary,
          },
        });

        initializedMap.addLayer({
          id: "territory-fill",
          type: "fill",
          source: "territory-boundary",
          paint: {
            "fill-color": territory.color || "#3b82f6",
            "fill-opacity": 0.2,
          },
        });

        initializedMap.addLayer({
          id: "territory-outline",
          type: "line",
          source: "territory-boundary",
          paint: {
            "line-color": territory.color || "#3b82f6",
            "line-width": 3,
          },
        });

        // Fit to boundary
        const bounds = new mapboxgl.LngLatBounds();
        territory.boundary.coordinates[0].forEach((coord: number[]) => {
          bounds.extend([coord[0], coord[1]]);
        });
        initializedMap.fitBounds(bounds, { padding: 50 });
      }
    });

    map.current = initializedMap;

    return () => {
      initializedMap.remove();
      map.current = null;
    };
  }, [territory]);

  // Add house markers
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Remove existing house markers
    const existingMarkers = document.querySelectorAll(".house-marker");
    existingMarkers.forEach((el) => el.remove());

    houses.forEach((house) => {
      const [lng, lat] = house.coordinates;

      const el = document.createElement("div");
      el.className = "house-marker";
      el.style.cssText = `
        width: ${bigMode ? "36px" : "24px"};
        height: ${bigMode ? "36px" : "24px"};
        background: ${house.is_dnc ? "#dc2626" : houseStatusColors[house.status]};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      if (house.is_dnc) {
        const span = document.createElement("span");
        span.style.color = "white";
        span.style.fontSize = "10px";
        span.style.display = "flex";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.height = "100%";
        span.style.fontWeight = "bold";
        span.textContent = "DNC";
        el.appendChild(span);
      }

      el.addEventListener("click", () => {
        setSelectedHouse(house);
        triggerHaptic(hapticPatterns.light);
      });

      if (map.current) {
        new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current);
      }
    });
  }, [houses, isMapLoaded, bigMode, triggerHaptic, hapticPatterns]);

  // Handle import
  const handleImport = useCallback(
    async (
      parsedHouses: {
        address: string;
        latitude?: number;
        longitude?: number;
        notes?: string;
        isDnc?: boolean;
      }[],
    ) => {
      const congregationId = user?.congregation_id;
      if (!congregationId) return;

      const housesToAdd = parsedHouses.map((h) => ({
        id: generateId(),
        territory_id: params.id,
        congregation_id: user.congregation_id,
        address: h.address,
        coordinates:
          h.latitude && h.longitude ? [h.longitude, h.latitude] : [0, 0],
        status: h.isDnc ? "dnc" : "not-visited",
        notes: h.notes || "",
        is_dnc: h.isDnc || false,
        dnc_encrypted_address: h.isDnc ? encryptDncAddress(h.address) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      try {
        await bulkAddHouses(housesToAdd);
        await sync();
        triggerHaptic(hapticPatterns.success);
        setShowImport(false);
      } catch (err) {
        logger.error("Import failed:", err);
        triggerHaptic(hapticPatterns.error);
      }
    },
    [params.id, user, bulkAddHouses, sync, triggerHaptic, hapticPatterns],
  );

  // Export houses to CSV
  const handleExport = useCallback(() => {
    const csv = [
      ["address", "latitude", "longitude", "status", "notes", "is_dnc"].join(
        ",",
      ),
      ...houses.map((h) =>
        [
          `"${h.address}"`,
          h.coordinates[1],
          h.coordinates[0],
          h.status,
          `"${h.notes || ""}"`,
          h.is_dnc,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${territory?.name || "territory"}-houses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [houses, territory?.name]);

  // Delete house
  const handleDeleteHouse = useCallback(
    async (houseId: string) => {
      if (!confirm("Are you sure you want to delete this house?")) return;

      try {
        await deleteHouse(houseId);
        await sync();
        setSelectedHouse(null);
        triggerHaptic(hapticPatterns.success);
      } catch {
        triggerHaptic(hapticPatterns.error);
      }
    },
    [deleteHouse, sync, triggerHaptic, hapticPatterns],
  );

  // Stats
  const stats = useMemo(() => {
    const all = houses;
    return {
      total: all.length,
      notVisited: all.filter((h) => h.status === "not-visited").length,
      nah: all.filter((h) => h.status === "nah").length,
      interest: all.filter((h) => h.status === "interest").length,
      returnVisit: all.filter((h) => h.status === "return-visit").length,
      dnc: all.filter((h) => h.is_dnc).length,
    };
  }, [houses]);

  if (!territory) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading territory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/overseer"
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{territory.name}</h1>
            <p className="text-muted-foreground">
              {stats.total} houses •{" "}
              {territory.status === "in-stock"
                ? "In Stock"
                : territory.status === "out"
                  ? "Checked Out"
                  : "Pending"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <QRCodeGenerator
            territoryId={params.id}
            territoryName={territory.name}
          />
          <Link
            href={`/overseer/territories/${params.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} color="bg-blue-500" />
        <StatCard
          label="Not Visited"
          value={stats.notVisited}
          color="bg-gray-400"
        />
        <StatCard label="NAH" value={stats.nah} color="bg-amber-500" />
        <StatCard
          label="Interest"
          value={stats.interest}
          color="bg-green-500"
        />
        <StatCard label="RV" value={stats.returnVisit} color="bg-purple-500" />
        <StatCard label="DNC" value={stats.dnc} color="bg-red-500" />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-border overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab("map")}
          className={`px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === "map"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="hidden sm:inline">Map View</span>
          <span className="sm:hidden">Map</span>
        </button>
        <button
          onClick={() => setActiveTab("list")}
          className={`px-3 sm:gap-2 px-4 py-2 font-medium transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === "list"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Houses ({stats.total})
        </button>
      </div>

      {/* Map View */}
      {activeTab === "map" && (
        <div className="space-y-4">
          <div className="h-[500px] rounded-xl overflow-hidden border border-border relative">
            <div ref={mapContainer} className="w-full h-full" />
            {!isMapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Import/Export Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Import Houses
            </button>
            {houses.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>

          {/* Import Modal */}
          {showImport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-card rounded-2xl border border-border shadow-xl max-w-xl w-full p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Import Houses</h3>
                  <button
                    onClick={() => setShowImport(false)}
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <HouseImport territoryId={params.id} onImport={handleImport} />
                <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">
                    CSV Format:
                  </p>
                  <code className="block bg-background p-2 rounded">
                    address, latitude, longitude, notes, DNC
                  </code>
                  <p className="mt-2">
                    Example:{" "}
                    <code>
                      123 Main St, 40.7128, -74.0060, Gate code: 1234, false
                    </code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {activeTab === "list" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {houses.length === 0 ? (
            <div className="text-center py-16">
              <Home className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Houses Yet</h3>
              <p className="text-muted-foreground mb-6">
                Import houses or add them manually
              </p>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              >
                <Plus className="w-5 h-5" />
                Import Houses
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {houses.map((house) => (
                <div
                  key={house.id}
                  onClick={() => setSelectedHouse(house)}
                  className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: house.is_dnc
                          ? "#dc2626"
                          : houseStatusColors[house.status],
                      }}
                    />
                    <div>
                      <p className="font-medium">{house.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {houseStatusLabels[house.status]}
                        {house.last_visited &&
                          ` • ${formatRelativeTime(house.last_visited)}`}
                      </p>
                    </div>
                  </div>
                  <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* House Detail Modal */}
      {selectedHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedHouse.address}</h3>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mt-1"
                  style={{
                    backgroundColor: selectedHouse.is_dnc
                      ? "#dc262620"
                      : `${houseStatusColors[selectedHouse.status]}20`,
                    color: selectedHouse.is_dnc
                      ? "#dc2626"
                      : houseStatusColors[selectedHouse.status],
                  }}
                >
                  {selectedHouse.is_dnc
                    ? "Do Not Call"
                    : houseStatusLabels[selectedHouse.status]}
                </span>
              </div>
              <button
                onClick={() => setSelectedHouse(null)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedHouse.notes && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="mt-1">{selectedHouse.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mb-6">
              <div>
                <p className="text-muted-foreground">Last Visited</p>
                <p className="font-medium">
                  {selectedHouse.last_visited
                    ? formatRelativeTime(selectedHouse.last_visited)
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Coordinates</p>
                <p className="font-medium">
                  {selectedHouse.coordinates[1].toFixed(4)},{" "}
                  {selectedHouse.coordinates[0].toFixed(4)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedHouse(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleDeleteHouse(selectedHouse.id)}
                className="flex items-center gap-2 px-4 py-2 text-destructive border border-destructive rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-card p-3 rounded-lg border border-border text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
