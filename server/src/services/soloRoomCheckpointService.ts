import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import type { PlayerEncounterAction } from '../types/encounterSnapshot.js';
import {
  clearSoloRoomCheckpoint,
  getSoloRoomCheckpoint,
} from '../db/postgresDocumentStore.js';

export interface LockedEncounterChoice {
  snapshotId: string;
  selectedAction: PlayerEncounterAction;
  selectedSolutionId?: number;
}

export interface SoloRoomCheckpoint {
  roomId: string;
  activeEncounterSnapshot: EncounterRoom['activeEncounterSnapshot'];
  slotEncounterSnapshots: EncounterRoom['slotEncounterSnapshots'];
  roomState: EncounterRoom['roomState'];
  systemEvent?: EncounterRoom['systemEvent'];
  lastEncounterId?: number;
  helpCalledSnapshotId?: string;
  loreGemActivated?: boolean;
  loreGemActivatedSnapshotId?: string;
  slotStates: EncounterRoom['slotStates'];
  mergedExpansions: number[];
  participant: Pick<
    RoomParticipant,
    | 'choiceState'
    | 'selectedAction'
    | 'selectedSolutionId'
    | 'preparedResult'
    | 'preparedCommit'
    | 'continuePressed'
    | 'focusState'
    | 'loreGemCollected'
    | 'resolutionSummary'
    | 'setPicks'
  >;
  lockedChoice?: LockedEncounterChoice;
  createdAt: number;
  updatedAt: number;
}

function engagedCount(room: EncounterRoom): number {
  return room.participants.filter((p) => p.choiceState !== 'disengaged').length;
}

export function isSoloLeaderRoom(room: EncounterRoom): boolean {
  return engagedCount(room) <= 1;
}

function leaderParticipant(room: EncounterRoom): RoomParticipant | undefined {
  return room.participants.find((p) => p.playerId === room.leaderPlayerId);
}

export function checkpointFromRoom(room: EncounterRoom): SoloRoomCheckpoint | null {
  if (!isSoloLeaderRoom(room) || room.roomState === 'closed') {
    return null;
  }

  const leader = leaderParticipant(room);
  if (!leader) {
    return null;
  }

  const snapshotId = room.slotEncounterSnapshots[leader.slotIndex]?.snapshotId
    ?? room.activeEncounterSnapshot.snapshotId;

  const lockedChoice: LockedEncounterChoice | undefined =
    leader.selectedAction
      ? {
        snapshotId,
        selectedAction: leader.selectedAction,
        selectedSolutionId: leader.selectedSolutionId,
      }
      : undefined;

  return {
    roomId: room.roomId,
    activeEncounterSnapshot: room.activeEncounterSnapshot,
    slotEncounterSnapshots: room.slotEncounterSnapshots,
    roomState: room.roomState,
    systemEvent: room.systemEvent,
    lastEncounterId: room.lastEncounterId,
    helpCalledSnapshotId: room.helpCalledSnapshotId,
    loreGemActivated: room.loreGemActivated,
    loreGemActivatedSnapshotId: room.loreGemActivatedSnapshotId,
    slotStates: room.slotStates,
    mergedExpansions: room.mergedExpansions,
    participant: {
      choiceState: leader.choiceState,
      selectedAction: leader.selectedAction,
      selectedSolutionId: leader.selectedSolutionId,
      preparedResult: leader.preparedResult,
      preparedCommit: leader.preparedCommit,
      continuePressed: leader.continuePressed,
      focusState: leader.focusState,
      loreGemCollected: leader.loreGemCollected,
      resolutionSummary: leader.resolutionSummary,
      // Locked set picks survive leaving and reloading: a reload cannot undo them.
      setPicks: leader.setPicks,
    },
    lockedChoice,
    createdAt: room.createdAt,
    updatedAt: Date.now(),
  };
}

export async function clearSoloCheckpointForAvatar(
  playerId: string,
  avatarId: string,
): Promise<void> {
  await clearSoloRoomCheckpoint(playerId, avatarId);
}

export async function loadSoloRoomCheckpoint(
  playerId: string,
  avatarId: string,
): Promise<SoloRoomCheckpoint | null> {
  return getSoloRoomCheckpoint<SoloRoomCheckpoint>(playerId, avatarId);
}

export function assertEncounterChoiceAllowed(
  room: EncounterRoom,
  playerId: string,
  playerAction: PlayerEncounterAction,
  solutionId: number | undefined,
  lockedChoice: LockedEncounterChoice | undefined,
): void {
  if (!lockedChoice || !isSoloLeaderRoom(room)) {
    return;
  }

  const leader = leaderParticipant(room);
  if (!leader || leader.playerId !== playerId) {
    return;
  }

  const snapshotId = room.slotEncounterSnapshots[leader.slotIndex]?.snapshotId
    ?? room.activeEncounterSnapshot.snapshotId;

  if (lockedChoice.snapshotId !== snapshotId) {
    return;
  }

  const sameAction = actionsEqual(lockedChoice.selectedAction, playerAction);
  const sameSolution = (lockedChoice.selectedSolutionId ?? undefined) === (solutionId ?? undefined);

  if (!sameAction || !sameSolution) {
    throw new ChoiceLockedError();
  }
}

function actionsEqual(
  left: PlayerEncounterAction,
  right: PlayerEncounterAction,
): boolean {
  if (left.type !== right.type) {
    return false;
  }
  const leftPicks = left.type === 'dice' ? undefined : left.picks;
  const rightPicks = right.type === 'dice' ? undefined : right.picks;
  const leftDice = left.type === 'dice' ? false : left.diceFill === true;
  const rightDice = right.type === 'dice' ? false : right.diceFill === true;
  return (leftPicks ?? []).join() === (rightPicks ?? []).join() && leftDice === rightDice;
}

export class ChoiceLockedError extends Error {
  readonly statusCode = 409;
  readonly code = 'CHOICE_LOCKED';

  constructor() {
    super('Encounter choice is locked for this snapshot');
    this.name = 'ChoiceLockedError';
  }
}
