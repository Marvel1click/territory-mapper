import { describe, expect, it } from 'vitest';
import { assumedMasterMatches, replicationResolution } from '@/app/lib/domain/replication';
import type { ReplicationDocument } from '@/app/types';

const master = (version: number, timestamp = '2026-01-01T00:00:00.000Z'): ReplicationDocument => ({ id: 'one', version, server_updated_at: timestamp });

describe('replication conflict rules', () => {
  it('matches an assumed master by version and server timestamp', () => {
    expect(assumedMasterMatches(master(2), master(2))).toBe(true);
    expect(assumedMasterMatches(master(3), master(2))).toBe(false);
    expect(assumedMasterMatches(null, null)).toBe(true);
  });

  it('keeps visits append-only and requires explicit boundary reapply', () => {
    expect(replicationResolution('visits')).toBe('append-only');
    expect(replicationResolution('territories')).toBe('reapply-required');
    expect(replicationResolution('houses')).toBe('server-wins');
  });
});
