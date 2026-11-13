import type { PlayerEncounterAction } from '../../types/encounterSnapshot.js';
import type { EncounterResolution } from '../../engine/encounterResolver.js';
import type { RollOutcome } from '../../engine/diceInterpreter.js';
import type { AvatarDocument } from '../../types/avatar.js';
import type { AvatarInventory } from '../../types/avatar.js';
import type { EncounterContinuedEventContext } from '../../services/gameEventService.js';
import type { AvatarProgression } from '../avatar/AvatarProgression.js';

export type ParticipantChoiceState =
  | 'choosing'
  | 'ready'
  | 'ready_to_continue'
  | 'resolved'
  | 'witnessing'
  | 'disengaged';

export type ParticipantFocusState =
  | 'none'
  | 'lore'
  | 'inventory'
  | 'skillbook'
  | 'avatar_details';

/** A locked pick of a solution set: its slot, the item it takes, and its revealed roll (D-025). */
export interface SolutionSetPickRecord {
  slot: 'A' | 'B' | 'C' | 'D';
  solutionId: number;
  roll: number;
}

export interface ParticipantResolutionSummary {
  success: boolean;
  message: string;
  selectedRoll?: number;
  rewards: number[];
  failurePenalty?: number;
  usedInventorySolutions?: number[];
  lostInventorySolutions?: number[];
  deathTriggered?: boolean;
  avatarDied?: boolean;
  leveledUp?: boolean;
  /** Room encounter: yellow-red gem granted on commit for this participant. */
  loreGemGranted?: boolean;
  /** XP granted by the resolved encounter outcome shown to this participant. */
  gainedExperience?: number;
  /** Solution sets: each chosen solution's own roll, in the order chosen. */
  pickRolls?: number[];
  /** Solution sets finished by the dice: the dice roll. */
  diceFillRoll?: number;
}

/** Reveal-only outcome attached after prepare; not persisted to avatar until room commit. */
export interface ParticipantPreparedResult extends ParticipantResolutionSummary {}

/** Server-only bundle required to commit a prepared encounter outcome. */
export interface PreparedCommitBundle {
  resolution: EncounterResolution;
  selectedRollOutcome: RollOutcome | null;
  deathTriggered: boolean;
  avatarDied: boolean;
  gainedExperience: number;
  eventContext: EncounterContinuedEventContext;
  nextInventory: AvatarInventory;
  nextProgression: AvatarProgression;
  updatedAvatar: AvatarDocument;
}

export interface RoomParticipant {
  playerId: string;
  avatarId: string;
  slotIndex: number;
  joinedAt: number;
  choiceState: ParticipantChoiceState;
  focusState: ParticipantFocusState;
  /** Solution set picks locked so far in this encounter, revealed one at a time (D-025). */
  setPicks?: SolutionSetPickRecord[];
  selectedAction?: PlayerEncounterAction;
  selectedSolutionId?: number;
  continuePressed: boolean;
  lastInteractionAt: number;
  disconnectedAt?: number;
  /** Committed summary after room advance (legacy / post-commit). */
  resolutionSummary?: ParticipantResolutionSummary;
  /** Dry-run outcome for UI reveal before group commit. */
  preparedResult?: ParticipantPreparedResult;
  /** Persisted only on commit tick — not exposed on DTO. */
  preparedCommit?: PreparedCommitBundle;
  /** Encounter snapshot id when the current prepared outcome was rolled (leave/rejoin guard). */
  outcomeSnapshotId?: string;
  /** Player collected the lore gem UI for the current encounter (grant on room commit). */
  loreGemCollected?: boolean;
}
