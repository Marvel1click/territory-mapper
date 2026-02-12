// Core type definitions for Territory Mapper

export type TerritoryStatus = 'in-stock' | 'out' | 'pending';

export type HouseStatus = 'not-visited' | 'nah' | 'interest' | 'return-visit' | 'dnc';

export type UserRole = 'overseer' | 'publisher' | 'admin';

export interface Congregation {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  settings: {
    default_map_center: [number, number];
    default_map_zoom: number;
  };
}

export interface Territory {
  id: string;
  name: string;
  description?: string;
  congregation_id: string;
  boundary: GeoJSON.Polygon;
  center: [number, number]; // [lng, lat]
  status: TerritoryStatus;
  color: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface House {
  id: string;
  territory_id: string;
  congregation_id: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  status: HouseStatus;
  notes?: string;
  is_dnc: boolean;
  dnc_encryption_key_id?: string;
  last_visited?: string;
  last_visitor?: string;
  return_visit_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  territory_id: string;
  territoryName?: string; // Populated from joined data (camelCase for frontend)
  publisher_id: string;
  publisher_name: string;
  congregation_id: string;
  checked_out_at: string;
  checked_out_by: string;
  due_date?: string;
  returned_at?: string;
  status: 'active' | 'returned' | 'overdue';
  qr_token?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  congregation_id: string;
  congregation?: Congregation;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncState {
  id: string;
  collection: string;
  last_sync: string;
  pending_changes: number;
  sync_status: 'idle' | 'syncing' | 'error';
}

export interface VoiceNote {
  id: string;
  house_id: string;
  transcript: string;
  audio_url?: string;
  created_at: string;
  created_by: string;
}

// GeoJSON types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// Accessibility types
export interface AccessibilitySettings {
  highContrast: boolean;
  bigMode: boolean;
  haptics: boolean;
  voiceEnabled: boolean;
  reducedMotion: boolean;
}

// Map types
export interface MapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface TerritoryBoundaryEdit {
  territoryId: string;
  coordinates: number[][][];
  isValid: boolean;
}
