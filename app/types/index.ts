// Core type definitions for Territory Mapper

export type TerritoryStatus = 'in-stock' | 'out' | 'pending';

export type HouseStatus = 'not-visited' | 'nah' | 'interest' | 'return-visit' | 'dnc';

export type UserRole = 'overseer' | 'publisher' | 'admin';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';

export type VisitOutcome =
  | 'not-home'
  | 'contacted'
  | 'interested'
  | 'return-visit'
  | 'do-not-call';

export type ReplicatedCollection = 'territories' | 'houses' | 'assignments' | 'visits';

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
  version: number;
  server_updated_at: string;
  deleted_at?: string | null;
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
  version: number;
  server_updated_at: string;
  deleted_at?: string | null;
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
  created_at: string;
  updated_at: string;
  version: number;
  server_updated_at: string;
  deleted_at?: string | null;
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

export interface Membership {
  id: string;
  user_id: string;
  congregation_id: string;
  role: UserRole;
  status: MembershipStatus;
  joined_at?: string | null;
  invited_by?: string | null;
  created_at: string;
  updated_at: string;
  congregation?: Pick<Congregation, 'id' | 'name'>;
  profile?: Pick<UserProfile, 'id' | 'email' | 'full_name' | 'phone'>;
}

export interface Invite {
  id: string;
  congregation_id: string;
  email: string;
  role: UserRole;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  invited_by: string;
  created_at: string;
}

export interface Visit {
  id: string;
  house_id: string;
  territory_id: string;
  congregation_id: string;
  visitor_id: string;
  outcome: VisitOutcome;
  notes?: string | null;
  visited_at: string;
  follow_up_at?: string | null;
  mutation_id: string;
  version: number;
  server_updated_at: string;
  deleted_at?: string | null;
}

export interface DncWarning {
  id: string;
  house_id: string;
  territory_id: string;
  coordinates: [number, number];
  label: 'Do not call nearby';
  warning_radius_m: number;
}

export interface SyncCheckpoint {
  server_updated_at: string;
  id: string;
}

export interface ReplicationDocument {
  id: string;
  version: number;
  server_updated_at: string;
  deleted_at?: string | null;
  last_mutation_id?: string | null;
  [key: string]: unknown;
}

export interface ReplicationConflict {
  id: string;
  collection: ReplicatedCollection;
  assumed_master: ReplicationDocument | null;
  server_document: ReplicationDocument;
  client_document: ReplicationDocument;
  resolution: 'server-wins' | 'append-only' | 'reapply-required';
}

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ORIGIN_REJECTED'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'CHECKOUT_TOKEN_INVALID'
  | 'CHECKOUT_TOKEN_EXPIRED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
  requestId: string;
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
