import { useSyncExternalStore } from 'react';

/**
 * Level-up choice (D-049): while the picked reward bounces and shows its roll,
 * nothing else may reveal that roll yet (the result, the number on the avatar).
 * Holds the level-up encounter's snapshot id, or null.
 */
let heldSnapshotId: string | null = null;
const listeners = new Set<() => void>();

export function setLevelUpRollHold(snapshotId: string | null): void {
  if (heldSnapshotId === snapshotId) {
    return;
  }
  heldSnapshotId = snapshotId;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLevelUpRollHold(): string | null {
  return useSyncExternalStore(subscribe, () => heldSnapshotId, () => null);
}
