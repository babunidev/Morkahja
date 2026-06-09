import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import type { PlayerEncounterAction } from '../types/encounterSnapshot.js';
import {
  clearSoloRoomCheckpoint,
  getSoloRoomCheckpoint,
  setSoloRoomCheckpoint,
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
    },
    lockedChoice,
    createdAt: room.createdAt,
    updatedAt: Date.now(),
  };
}

export async function parkSoloRoomCheckpoint(room: EncounterRoom): Promise<void> {
  const checkpoint = checkpointFromRoom(room);
  if (!checkpoint) {
    return;
  }

  const leader = leaderParticipant(room);
  if (!leader) {
    return;
  }

  await setSoloRoomCheckpoint(leader.playerId, leader.avatarId, checkpoint);
}

export async function syncSoloRoomCheckpoint(room: EncounterRoom): Promise<void> {
  if (room.roomState === 'closed') {
    return;
  }
  await parkSoloRoomCheckpoint(room);
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

export async function loadLockedChoiceForAvatar(
  playerId: string,
  avatarId: string,
): Promise<LockedEncounterChoice | undefined> {
  const checkpoint = await loadSoloRoomCheckpoint(playerId, avatarId);
  return checkpoint?.lockedChoice;
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
  return left.type === right.type;
}

export class ChoiceLockedError extends Error {
  readonly statusCode = 409;
  readonly code = 'CHOICE_LOCKED';

  constructor() {
    super('Encounter choice is locked for this snapshot');
    this.name = 'ChoiceLockedError';
  }
}

export async function enforceOrLockSoloChoice(
  room: EncounterRoom,
  playerId: string,
  avatarId: string,
  playerAction: PlayerEncounterAction,
  solutionId: number | undefined,
): Promise<void> {
  if (!isSoloLeaderRoom(room)) {
    return;
  }

  const leader = leaderParticipant(room);
  if (!leader || leader.playerId !== playerId) {
    return;
  }

  const snapshotId = room.slotEncounterSnapshots[leader.slotIndex]?.snapshotId
    ?? room.activeEncounterSnapshot.snapshotId;

  const checkpoint = await loadSoloRoomCheckpoint(playerId, avatarId);
  const existingLock = checkpoint?.lockedChoice;

  if (existingLock && existingLock.snapshotId === snapshotId) {
    assertEncounterChoiceAllowed(room, playerId, playerAction, solutionId, existingLock);
    return;
  }

  const base = checkpoint ?? checkpointFromRoom(room);
  if (!base) {
    return;
  }

  base.lockedChoice = {
    snapshotId,
    selectedAction: playerAction,
    selectedSolutionId: solutionId,
  };
  base.updatedAt = Date.now();
  await setSoloRoomCheckpoint(leader.playerId, leader.avatarId, base);
}
