import type { ReplicatedCollection, ReplicationConflict, ReplicationDocument } from '@/app/types';

export function replicationResolution(
  collection: ReplicatedCollection,
): ReplicationConflict['resolution'] {
  if (collection === 'visits') return 'append-only';
  if (collection === 'territories') return 'reapply-required';
  return 'server-wins';
}

export function assumedMasterMatches(
  current: ReplicationDocument | null,
  assumed: ReplicationDocument | null,
): boolean {
  return current === null && assumed === null ||
    current !== null && assumed !== null &&
      current.version === assumed.version &&
      current.server_updated_at === assumed.server_updated_at;
}
