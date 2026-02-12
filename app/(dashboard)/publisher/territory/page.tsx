"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { logger } from "@/app/lib/utils/logger";

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAuth } from "@/app/hooks/useAuth";
import { useHouses, useAssignments, useSync } from "@/app/hooks/useRxDB";
import { useAccessibility } from "@/app/hooks/useAccessibility";
import { encryptDncAddress } from "@/app/lib/encryption/dnc";
import {
  calculateDistance,
  houseStatusColors,
  houseStatusLabels,
} from "@/app/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Home,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mic,
  X,
  Navigation,
} from "lucide-react";

// Set Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type HouseStatus = "not-visited" | "nah" | "interest" | "return-visit" | "dnc";

interface House {
  id: string;
  address: string;
  coordinates: [number, number];
  status: HouseStatus;
  notes?: string;
  is_dnc: boolean;
  return_visit_date?: string;
}

export default function PublisherTerritoryPage() {
  const { user } = useAuth();
  const { sync } = useSync(user?.congregation_id);
  const { triggerHaptic, hapticPatterns, bigMode } = useAccessibility();

  // Get active assignment for this user
  const { assignments } = useAssignments(user?.congregation_id);
  const activeAssignment = useMemo(() => {
    return assignments.find(
      (a) => a.publisher_id === user?.id && a.status === "active",
    );
  }, [assignments, user?.id]);

  const territoryId = activeAssignment?.territory_id;

  // Get houses for this territory
  const { houses, updateHouse } = useHouses(territoryId, user?.congregation_id);

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [returnVisitDate, setReturnVisitDate] = useState("");
  const [isReturnVisit, setIsReturnVisit] = useState(false);
  const [dncWarningShown, setDncWarningShown] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !territoryId) return;

    const initializedMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128],
      zoom: 14,
    });

    // Add navigation controls
    initializedMap.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add geolocate control
    initializedMap.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      "top-right",
    );

    initializedMap.on("load", () => {
      setIsMapLoaded(true);
    });

    map.current = initializedMap;

    return () => {
      initializedMap.remove();
      map.current = null;
    };
  }, [territoryId]);

  // Update markers when houses change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (houses.length === 0) return;

    // Calculate bounds to fit all houses
    const bounds = new mapboxgl.LngLatBounds();

    // Add markers for each house
    (houses as House[]).forEach((house) => {
      const [lng, lat] = house.coordinates;
      bounds.extend([lng, lat]);

      // Create marker element
      const el = document.createElement("div");
      el.className = "house-marker";
      el.style.cssText = `
        width: ${bigMode ? "40px" : "28px"};
        height: ${bigMode ? "40px" : "28px"};
        background: ${house.is_dnc ? "#dc2626" : houseStatusColors[house.status]};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      `;

      // Add content based on status
      if (house.is_dnc) {
        const span = document.createElement("span");
        span.style.color = "white";
        span.style.fontSize = "12px";
        span.style.fontWeight = "bold";
        span.textContent = "DNC";
        el.appendChild(span);
      } else if (house.status === "return-visit") {
        const span = document.createElement("span");
        span.style.color = "white";
        span.style.fontSize = "10px";
        span.textContent = "RV";
        el.appendChild(span);
      }

      // Add hover effect
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      // Create popup
      const popupContent = document.createElement("div");
      popupContent.style.padding = "8px";

      const addressLine = document.createElement("p");
      addressLine.style.fontWeight = "600";
      addressLine.style.margin = "0 0 4px 0";
      addressLine.textContent = house.address;

      const statusLine = document.createElement("p");
      statusLine.style.fontSize = "12px";
      statusLine.style.color = "#666";
      statusLine.style.margin = "0";
      statusLine.style.textTransform = "capitalize";
      statusLine.textContent = houseStatusLabels[house.status];

      popupContent.appendChild(addressLine);
      popupContent.appendChild(statusLine);

      const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(
        popupContent,
      );

      // Create and add marker
      if (!map.current) return;
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current);

      // Click handler
      el.addEventListener("click", () => {
        setSelectedHouse(house);
        setTranscript(house.notes || "");
        setIsReturnVisit(house.status === "return-visit");
        setReturnVisitDate(house.return_visit_date?.split("T")[0] || "");
        triggerHaptic(hapticPatterns.light);
      });

      markers.current.push(marker);
    });

    // Fit map to bounds
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [houses, isMapLoaded, bigMode, triggerHaptic, hapticPatterns]);

  // Watch user location for DNC proximity
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        setUserLocation(newLocation);

        // Check DNC proximity
        if (!dncWarningShown) {
          (houses as House[]).forEach((house) => {
            if (house.is_dnc) {
              const distance = calculateDistance(
                newLocation[1],
                newLocation[0],
                house.coordinates[1],
                house.coordinates[0],
              );

              if (distance < 50) {
                triggerHaptic(hapticPatterns.dncProximity);
                setDncWarningShown(true);
                // Reset warning after 30 seconds
                setTimeout(() => setDncWarningShown(false), 30000);
              }
            }
          });
        }
      },
      (err) => logger.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [houses, dncWarningShown, triggerHaptic, hapticPatterns]);

  // Handle status change
  const handleStatusChange = useCallback(
    async (status: HouseStatus) => {
      if (!selectedHouse) return;

      const updates: {
        status: HouseStatus;
        notes: string;
        last_visited: string;
        last_visitor: string | undefined;
        return_visit_date?: string;
        is_dnc?: boolean;
        dnc_encrypted_address?: string;
      } = {
        status,
        notes: transcript,
        last_visited: new Date().toISOString(),
        last_visitor: user?.id,
      };

      if (status === "return-visit" && returnVisitDate) {
        updates.return_visit_date = new Date(returnVisitDate).toISOString();
      }

      // Handle DNC encryption
      if (status === "dnc") {
        updates.is_dnc = true;
        updates.dnc_encrypted_address = encryptDncAddress(
          selectedHouse.address,
        );
      }

      try {
        await updateHouse(selectedHouse.id, updates);
        triggerHaptic(hapticPatterns.success);

        // Sync to server
        await sync();

        setSelectedHouse(null);
      } catch (err) {
        logger.error("Failed to update house:", err);
        triggerHaptic(hapticPatterns.error);
      }
    },
    [
      selectedHouse,
      transcript,
      returnVisitDate,
      user?.id,
      updateHouse,
      sync,
      triggerHaptic,
      hapticPatterns,
    ],
  );

  // Voice recording
  const startRecording = useCallback(() => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      alert("Voice recording is not supported in this browser");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      triggerHaptic(hapticPatterns.medium);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript((prev) => prev + (prev ? " " : "") + finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error("Speech recognition error:", event.error);
      setIsRecording(false);
      triggerHaptic(hapticPatterns.error);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, [triggerHaptic, hapticPatterns]);

  // Get statistics
  const stats = useMemo(() => {
    const all = houses as House[];
    return {
      total: all.length,
      visited: all.filter((h) => h.status !== "not-visited").length,
      notAtHome: all.filter((h) => h.status === "nah").length,
      interest: all.filter((h) => h.status === "interest").length,
      returnVisits: all.filter((h) => h.status === "return-visit").length,
      dnc: all.filter((h) => h.is_dnc).length,
    };
  }, [houses]);

  if (!territoryId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Active Territory</h2>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have any territory checked out.
          </p>
          <Link
            href="/publisher"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -mx-4 -my-6 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/publisher"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold">
              {activeAssignment?.territoryName || "My Territory"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {stats.visited}/{stats.total} houses visited
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${stats.total > 0 ? (stats.visited / stats.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {Math.round(
              stats.total > 0 ? (stats.visited / stats.total) * 100 : 0,
            )}
            %
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex gap-4 overflow-x-auto scrollbar-hide">
        <StatBadge
          icon={<Home className="w-4 h-4" />}
          label="Total"
          value={stats.total}
        />
        <StatBadge
          icon={<AlertCircle className="w-4 h-4" />}
          label="NAH"
          value={stats.notAtHome}
          color="text-amber-500"
        />
        <StatBadge
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Interest"
          value={stats.interest}
          color="text-green-500"
        />
        <StatBadge
          icon={<Clock className="w-4 h-4" />}
          label="RV"
          value={stats.returnVisits}
          color="text-purple-500"
        />
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}

        {/* DNC Warning */}
        {dncWarningShown && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Do Not Call area nearby</span>
            </div>
          </div>
        )}

        {/* Recenter button */}
        {userLocation && (
          <button
            onClick={() =>
              map.current?.flyTo({ center: userLocation, zoom: 16 })
            }
            className="absolute bottom-4 right-4 p-3 bg-card border border-border rounded-full shadow-lg hover:bg-accent transition-colors"
          >
            <Navigation className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* House status modal */}
      {selectedHouse && (
        <HouseStatusModal
          house={selectedHouse}
          transcript={transcript}
          setTranscript={setTranscript}
          isRecording={isRecording}
          startRecording={startRecording}
          isReturnVisit={isReturnVisit}
          _setIsReturnVisit={setIsReturnVisit}
          returnVisitDate={returnVisitDate}
          setReturnVisitDate={setReturnVisitDate}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedHouse(null)}
          bigMode={bigMode}
        />
      )}
    </div>
  );
}

// Stat badge component
function StatBadge({
  icon,
  label,
  value,
  color = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className={color}>{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// House status modal
interface HouseStatusModalProps {
  house: House;
  transcript: string;
  setTranscript: (t: string) => void;
  isRecording: boolean;
  startRecording: () => void;
  isReturnVisit: boolean;
  _setIsReturnVisit: (v: boolean) => void;
  returnVisitDate: string;
  setReturnVisitDate: (d: string) => void;
  onStatusChange: (status: HouseStatus) => void;
  onClose: () => void;
  bigMode: boolean;
}

function HouseStatusModal({
  house,
  transcript,
  setTranscript,
  isRecording,
  startRecording,
  isReturnVisit,
  _setIsReturnVisit,
  returnVisitDate,
  setReturnVisitDate,
  onStatusChange,
  onClose,
  bigMode,
}: HouseStatusModalProps) {
  const statuses: {
    value: HouseStatus;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      value: "nah",
      label: "Not at Home",
      icon: <AlertCircle className="w-5 h-5" />,
      color: "bg-gray-500",
    },
    {
      value: "interest",
      label: "Interest",
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "bg-green-500",
    },
    {
      value: "return-visit",
      label: "Return Visit",
      icon: <Clock className="w-5 h-5" />,
      color: "bg-purple-500",
    },
    {
      value: "dnc",
      label: "Do Not Call",
      icon: <X className="w-5 h-5" />,
      color: "bg-red-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div
        className={`bg-card w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto ${bigMode ? "text-lg" : ""}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{house.address}</h3>
              <p className="text-sm text-muted-foreground">
                {houseStatusLabels[house.status]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status buttons */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => onStatusChange(status.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                house.status === status.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              } ${bigMode ? "min-h-[80px]" : ""}`}
              style={{ minHeight: bigMode ? "80px" : "64px" }}
            >
              <div className={`p-2 rounded-lg ${status.color} text-white`}>
                {status.icon}
              </div>
              <span className="font-medium text-sm">{status.label}</span>
            </button>
          ))}
        </div>

        {/* Return visit date */}
        {isReturnVisit && (
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium mb-2">
              Return Visit Date
            </label>
            <input
              type="date"
              value={returnVisitDate}
              onChange={(e) => setReturnVisitDate(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border border-input bg-background ${bigMode ? "text-lg" : ""}`}
            />
          </div>
        )}

        {/* Notes */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Notes</label>
            <button
              onClick={startRecording}
              disabled={isRecording}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isRecording
                  ? "bg-red-500/10 text-red-500 animate-pulse"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {isRecording ? (
                <>
                  <Mic className="w-4 h-4" />
                  Recording...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Voice Note
                </>
              )}
            </button>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Add notes about this visit..."
            rows={3}
            className={`w-full px-4 py-3 rounded-lg border border-input bg-background resize-none ${bigMode ? "text-lg" : ""}`}
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors font-medium ${bigMode ? "text-lg" : ""}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onStatusChange(house.status)}
            className={`flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium ${bigMode ? "text-lg" : ""}`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
