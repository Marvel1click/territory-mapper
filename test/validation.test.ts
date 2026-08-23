import { describe, expect, it } from 'vitest';
import { createInviteSchema, createTerritorySchema, geocodePreviewSchema, replicationPushSchema } from '@/app/lib/validation/schemas';

describe('request validation', () => {
  it('normalizes invite email and accepts only known roles', () => {
    expect(createInviteSchema.parse({ email: ' Admin@Example.COM ', role: 'publisher' }).email).toBe('admin@example.com');
    expect(() => createInviteSchema.parse({ email: 'a@example.com', role: 'owner' })).toThrow();
  });

  it('requires closed territory polygon rings', () => {
    const base = { name: 'North', color: '#2f6f4e' };
    expect(() => createTerritorySchema.parse({ ...base, boundary: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] } })).toThrow();
    expect(createTerritorySchema.parse({ ...base, boundary: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }).name).toBe('North');
  });

  it('requires coordinate pairs in import previews', () => {
    expect(() => geocodePreviewSchema.parse({ rows: [{ row: 2, address: '10 High St', latitude: 51.5 }] })).toThrow();
  });

  it('bounds replication batches', () => {
    expect(() => replicationPushSchema.parse({ collection: 'visits', rows: [] })).toThrow();
  });
});
