import type { GameEventVisibility } from '../events/GameEvent.js';

/** Friends-only in Scribes by default; milestone levels (5, 10, 15, …) are public. */
export function levelUpScribeVisibility(level: number): GameEventVisibility {
  if (!Number.isInteger(level) || level < 1) {
    return 'friends';
  }

  return level % 5 === 0 ? 'global' : 'friends';
}
