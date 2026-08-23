import { describe, expect, it } from 'vitest';
import { assertSameOrigin, throttleMutation } from '@/app/lib/api/request';
import { useSyncStore } from '@/app/lib/store';

describe('request security controls', () => {
  it('accepts verified same-origin mutations and rejects cross-site or unverifiable requests', () => {
    expect(() => assertSameOrigin(new Request('https://mapper.example/api/visits', {
      method: 'POST',
      headers: { origin: 'https://mapper.example', 'sec-fetch-site': 'same-origin' },
    }))).not.toThrow();

    expect(() => assertSameOrigin(new Request('https://mapper.example/api/visits', {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    }))).toThrow(/origin is not allowed/i);

    expect(() => assertSameOrigin(new Request('https://mapper.example/api/visits', {
      method: 'POST',
    }))).toThrow(/could not be verified/i);
  });

  it('throttles repeated mutations by actor and scope', () => {
    const actor = crypto.randomUUID();
    throttleMutation(actor, 'test', { limit: 1, windowMs: 60_000 });
    expect(() => throttleMutation(actor, 'test', { limit: 1, windowMs: 60_000 }))
      .toThrow(/too many changes/i);
  });
});

describe('user-switch isolation state', () => {
  it('clears synchronization metadata on logout', () => {
    const store = useSyncStore.getState();
    store.setLastSync('2026-08-23T10:00:00.000Z');
    store.setPendingChanges(3);
    store.setOfflineDataReady(true);
    store.setBasemapReady(true);

    store.resetSyncState();

    const reset = useSyncStore.getState();
    expect(reset.lastSync).toBeNull();
    expect(reset.pendingChanges).toBe(0);
    expect(reset.offlineDataReady).toBe(false);
    expect(reset.basemapReady).toBe(false);
  });
});
