import type {
  EncounterRoomSnapshotDto,
  RoomParticipantDto,
} from '../../api/http.js';

function engagedParticipants(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
}

function participantsAwaitingContinue(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  return engagedParticipants(room).filter(
    (participant) =>
      participant.resolutionSummary !== undefined
      || participant.choiceState === 'resolved',
  );
}

function isPostSystemEventContinue(room: EncounterRoomSnapshotDto): boolean {
  return room.systemEvent?.lastEventRecap !== undefined;
}

/** True when another adventurer is in the party (not disengaged). */
export function isPartySession(room: EncounterRoomSnapshotDto | null | undefined): boolean {
  if (!room) {
    return false;
  }
  return engagedParticipants(room).length > 1;
}

/** Mirrors server `continueTargetsForRoom` for UI gating. */
export function continueTargets(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  if (isPostSystemEventContinue(room)) {
    return engagedParticipants(room);
  }

  const awaitingContinue = participantsAwaitingContinue(room);
  return awaitingContinue.length > 0 ? awaitingContinue : engagedParticipants(room);
}

export function isMultiplayerContinue(room: EncounterRoomSnapshotDto | null | undefined): boolean {
  return isPartySession(room);
}

export function shouldDeferRewardDismiss(
  room: EncounterRoomSnapshotDto | null | undefined,
  resultsVisible: boolean,
): boolean {
  if (!room || !isPartySession(room) || !resultsVisible) {
    return false;
  }

  if (room.roomState === 'waiting_continue') {
    return true;
  }

  const local = room.participants.find((participant) => participant.isLocal);
  return local?.choiceState === 'ready' || local?.choiceState === 'resolved';
}

export function allContinuePressed(room: EncounterRoomSnapshotDto): boolean {
  const targets = continueTargets(room);
  return targets.length > 0 && targets.every((participant) => participant.continuePressed);
}

export function localContinuePressed(room: EncounterRoomSnapshotDto): boolean {
  const local = room.participants.find((participant) => participant.isLocal);
  return local?.continuePressed === true;
}

export function multiplayerContinueWaiting(
  room: EncounterRoomSnapshotDto | null | undefined,
  pendingPartyContinue = false,
): boolean {
  if (!isPartySession(room)) {
    return false;
  }

  if (pendingPartyContinue) {
    return true;
  }

  if (room?.roomState !== 'waiting_continue') {
    return false;
  }

  return localContinuePressed(room) && !allContinuePressed(room);
}
