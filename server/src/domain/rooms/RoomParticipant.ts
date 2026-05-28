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
  | 'skillbook';

export interface ParticipantResolutionSummary {
  success: boolean;
  message: string;
  selectedRoll?: number;
  rewards: number[];
  failurePenalty?: number;
  usedInventorySolutions?: number[];
  deathTriggered?: boolean;
  avatarDied?: boolean;
  leveledUp?: boolean;
}

/** Reveal-only outcome attached after prepare; not persisted to avatar until room commit. */
export interface ParticipantPreparedResult extends ParticipantResolutionSummary {}

/** Server-only bundle required to commit a prepared encounter outcome. */
export interface PreparedCommitBundle {
  resolution: EncounterResolution;
  selectedRollOutcome: RollOutcome | null;
  deathTriggered: boolean;
  avatarDied: boolean;
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
  /** Player collected the lore gem UI for the current encounter (grant on room commit). */
  loreGemCollected?: boolean;
}
