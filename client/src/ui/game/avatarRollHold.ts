import { useSyncExternalStore } from 'react';

/**
 * Babuni (2026-11-18): the roll numbers fly into the avatar and only then does
 * the big total grow there. From the moment a choice is committed until the
 * numbers arrive, the local avatar keeps its roll back. A hold always ends by
 * itself after HOLD_SAFETY_MS, so the number can never stay hidden.
 */
const HOLD_SAFETY_MS = 5000;

let held: { snapshotId: string; timer: number } | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function holdAvatarRoll(snapshotId: string): void {
  if (held) {
    window.clearTimeout(held.timer);
  }
  held = {
    snapshotId,
    timer: window.setTimeout(() => releaseAvatarRoll(snapshotId), HOLD_SAFETY_MS),
  };
  notify();
}

/** Ends the hold (for this encounter only, when one is given). */
export function releaseAvatarRoll(snapshotId?: string): void {
  if (!held || (snapshotId !== undefined && held.snapshotId !== snapshotId)) {
    return;
  }
  window.clearTimeout(held.timer);
  held = null;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the local avatar's roll waits for its numbers to arrive. */
export function useAvatarRollHeld(): boolean {
  return useSyncExternalStore(subscribe, () => held !== null, () => false);
}
