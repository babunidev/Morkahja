import type { PlayerEncounterAction } from '../../types/encounterSnapshot.js';

export type ParticipantChoiceState =
  | 'choosing'
  | 'ready'
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
  resolutionSummary?: ParticipantResolutionSummary;
}
