import type { EncounterSnapshot } from './encounterSnapshot.js';

export interface AvatarProfile {
  /** Expansion ids the avatar has unlocked (e.g. 1, 2, 1004). */
  unlockedExpansions: number[];
}

export interface AvatarProgression {
  /** Last completed encounter id — drives follow-chain on next create. */
  lastEncounterId?: number;
  [key: string]: unknown;
}

/**
 * Avatar document at `/players/{playerId}/avatars/{avatarId}`.
 * Active encounter snapshot lives in the `activeEncounter/current` subdocument.
 */
export interface AvatarDocument {
  inventory: number[];
  profile: AvatarProfile;
  progression: AvatarProgression;
  /** Optional denormalized pointer; authoritative data is in subcollection. */
  activeEncounter?: EncounterSnapshot | null;
}
