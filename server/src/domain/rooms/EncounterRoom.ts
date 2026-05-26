import type { EncounterSnapshot } from '../../types/encounterSnapshot.js';
import type { RoomParticipant } from './RoomParticipant.js';
import type { SlotState } from './RoomSlot.js';
import type { RoomSystemEventContext } from './RoomSystemEvent.js';

export type RoomState =
  | 'active_encounter'
  | 'resolving'
  | 'system_event'
  | 'waiting_continue'
  | 'closed';

export interface EncounterRoom {
  roomId: string;
  leaderPlayerId: string;
  participants: RoomParticipant[];
  slotStates: [SlotState, SlotState, SlotState];
  mergedExpansions: number[];
  activeEncounterSnapshot: EncounterSnapshot;
  roomState: RoomState;
  /** Witnessed level-up / Atranor flow and encounter lineage for advance. */
  systemEvent?: RoomSystemEventContext;
  /** Room-level last encounter for shared follow context. */
  lastEncounterId?: number;
  /** Snapshot id for which Call for Help was already used. */
  helpCalledSnapshotId?: string;
  createdAt: number;
  updatedAt: number;
}
