/**
 * Input validation utilities for API routes.
 * Simple validation without external dependencies.
 */

/** Validate a string field doesn't exceed max length */
export function validateString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

/** Validate a coordinate pair [lng, lat] */
export function validateCoordinates(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return (
    typeof lng === 'number' && typeof lat === 'number' &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90 &&
    isFinite(lng) && isFinite(lat)
  );
}

/** Validate a GeoJSON Polygon boundary */
export function validateBoundary(boundary: unknown): boolean {
  if (!boundary || typeof boundary !== 'object') return false;
  const b = boundary as Record<string, unknown>;
  if (b.type !== 'Polygon') return false;
  if (!Array.isArray(b.coordinates)) return false;
  // Must have at least one ring
  if (b.coordinates.length === 0) return false;
  // Each ring must have at least 4 points (closed polygon)
  for (const ring of b.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) return false;
      if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return false;
      if (!isFinite(point[0]) || !isFinite(point[1])) return false;
    }
  }
  return true;
}

const TERRITORY_STATUSES = new Set(['in-stock', 'out', 'pending']);
const HOUSE_STATUSES = new Set(['not-visited', 'nah', 'interest', 'return-visit', 'dnc']);
const ASSIGNMENT_STATUSES = new Set(['active', 'returned', 'overdue']);

/** Validate territory status */
export function validateTerritoryStatus(status: unknown): boolean {
  return typeof status === 'string' && TERRITORY_STATUSES.has(status);
}

/** Validate house status */
export function validateHouseStatus(status: unknown): boolean {
  return typeof status === 'string' && HOUSE_STATUSES.has(status);
}

/** Validate assignment status */
export function validateAssignmentStatus(status: unknown): boolean {
  return typeof status === 'string' && ASSIGNMENT_STATUSES.has(status);
}

/** Validate a hex color string */
export function validateColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Validate an ISO date string */
export function validateISODate(date: unknown): boolean {
  if (typeof date !== 'string') return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/** Max lengths for text fields */
export const MAX_LENGTHS = {
  name: 200,
  description: 2000,
  address: 500,
  notes: 5000,
  publisherName: 200,
  qrToken: 100,
  color: 7,
} as const;
