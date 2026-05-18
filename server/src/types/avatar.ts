import type { EncounterSnapshot } from './encounterSnapshot.js';

export interface InventoryItem {
  solutionId: number;
  solutionType: number;
  uses: number;
}

export interface AvatarInventory {
  spellbook: InventoryItem[];
  items: InventoryItem[];
  essences: InventoryItem[];
}

export interface AvatarProfile {
  /** Reward type used for role-based spellbook initialization. */
  roleRewardType?: 37 | 38 | 39;
  /** Reward type used for race-based spellbook initialization. */
  raceRewardType?: 40 | 41 | 42 | 43;
}

export interface AvatarDocumentProgression {
  /** Last completed encounter id — drives follow-chain on next create. */
  lastEncounterId?: number;
  [key: string]: unknown;
}

/**
 * Avatar document at `/players/{playerId}/avatars/{avatarId}`.
 * Active encounter snapshot lives in the `activeEncounter/current` subdocument.
 */
export interface AvatarDocument {
  id?: string;
  name?: string;
  race?: 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
  role?: 'Mage' | 'Warrior' | 'Rogue';
  level?: number;
  experience?: number;
  portrait?: string;
  frame?: string;
  createdAt?: number;
  lastPlayedAt?: number;
  /** Denormalized cache only; authoritative inventory lives in inventory/current. */
  inventory?: AvatarInventory;
  profile: AvatarProfile;
  progression: AvatarDocumentProgression;
  /** Enables character recreation after death-loop failure. */
  editMode?: boolean;
  /** Optional denormalized pointer; authoritative data is in subcollection. */
  activeEncounter?: EncounterSnapshot | null;
}
