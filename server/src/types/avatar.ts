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
  /** The two equipment slots (D-056): solution ids or null. Absent on older inventories. */
  equipped?: (number | null)[];
}

export interface AvatarProfile {
  /** Reward type used for role-based spellbook initialization. */
  roleRewardType?: 37 | 38 | 39;
  /** Reward type used for race-based spellbook initialization. */
  raceRewardType?: 40 | 41 | 42 | 43;
  /** Achievement rank title shown before the avatar name in-game. */
  displayTitle?: string | null;
}

export interface AvatarDocumentProgression {
  /** Last completed encounter id — drives follow-chain on next create. */
  lastEncounterId?: number;
  [key: string]: unknown;
}

export type AvatarLifeStatus = 'active' | 'failed' | 'deceased';

export interface AvatarPreDeathSnapshot {
  level: number;
  experience: number;
  inventory: AvatarInventory;
  progression: AvatarDocumentProgression;
  lastPlayedAt?: number;
  failedAt: number;
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
  /** Living avatars default to active when omitted. */
  status?: AvatarLifeStatus;
  /** Captured on Atranor Misery/Hardship before the player chooses sacrifice or final death. */
  preDeathSnapshot?: AvatarPreDeathSnapshot;
  /** Denormalized cache only; authoritative inventory lives in inventory/current. */
  inventory?: AvatarInventory;
  profile: AvatarProfile;
  progression: AvatarDocumentProgression;
  /** The skill type the avatar is good at: +1 to its skills' rolls (D-056). */
  specialization?: number | null;
  /** Enables character recreation after death-loop failure. */
  editMode?: boolean;
  /** Optional denormalized pointer; authoritative data is in subcollection. */
  activeEncounter?: EncounterSnapshot | null;
}
