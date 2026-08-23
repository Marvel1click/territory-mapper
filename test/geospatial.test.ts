import { describe, expect, it } from 'vitest';
import { calculateDistance, getTerritoryCenter, isPointInPolygon } from '@/app/lib/utils';

describe('geospatial domain rules', () => {
  const polygon = [[[-0.2, 51.4], [-0.1, 51.4], [-0.1, 51.6], [-0.2, 51.6], [-0.2, 51.4]]];

  it('detects points inside and outside a territory', () => {
    expect(isPointInPolygon([-0.15, 51.5], polygon)).toBe(true);
    expect(isPointInPolygon([0, 51.5], polygon)).toBe(false);
  });

  it('computes a stable boundary center', () => {
    expect(getTerritoryCenter(polygon)).toEqual([-0.15000000000000002, 51.5]);
  });

  it('measures short DNC warning distances in metres', () => {
    expect(calculateDistance(51.5, -0.1, 51.5001, -0.1)).toBeGreaterThan(10);
    expect(calculateDistance(51.5, -0.1, 51.5001, -0.1)).toBeLessThan(12);
  });
});
