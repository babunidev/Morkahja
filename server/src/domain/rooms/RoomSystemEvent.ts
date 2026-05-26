import type { RollOutcome } from '../../engine/diceInterpreter.js';
import type { PreparedEncounter } from '../../types/encounter.js';
import type { ParticipantResolutionSummary } from './RoomParticipant.js';

export type { RollOutcome };

export interface RoomSystemEventQueueItem {
  actorPlayerId: string;
  encounterId: number;
  /** After Atranor when death and level-up on the same roll. */
  chainedLevelUp?: boolean;
}

export interface RoomEncounterLineage {
  originEncounterId: number;
  originEncounterFollow: number;
  originRollOutcome: RollOutcome | null;
  originSuccess: boolean;
  preparedEncounter?: PreparedEncounter;
}

export interface RoomSystemEventContext {
  queue: RoomSystemEventQueueItem[];
  queueIndex: number;
  lineage: RoomEncounterLineage;
  lastEvent?: {
    kind: 'level_up' | 'atranor';
    actorPlayerId: string;
    resolutionSummary: ParticipantResolutionSummary;
  };
}

export const DEATH_ENCOUNTER_NUMERIC_ID = 1;
export const LEVEL_UP_ENCOUNTER_NUMERIC_ID = 2;
