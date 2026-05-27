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

/** Mirrors server `continueTargetsForRoom` for UI gating. */
export function continueTargets(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  if (isPostSystemEventContinue(room)) {
    return engagedParticipants(room);
  }

  const awaitingContinue = participantsAwaitingContinue(room);
  return awaitingContinue.length > 0 ? awaitingContinue : engagedParticipants(room);
}

export function isMultiplayerContinue(room: EncounterRoomSnapshotDto | null | undefined): boolean {
  if (!room || room.roomState !== 'waiting_continue') {
    return false;
  }
  return continueTargets(room).length > 1;
}

export function allContinuePressed(room: EncounterRoomSnapshotDto): boolean {
  const targets = continueTargets(room);
  return targets.length > 0 && targets.every((participant) => participant.continuePressed);
}

export function localContinuePressed(room: EncounterRoomSnapshotDto): boolean {
  const local = room.participants.find((participant) => participant.isLocal);
  return local?.continuePressed === true;
}

export function multiplayerContinueWaiting(room: EncounterRoomSnapshotDto | null | undefined): boolean {
  if (!room || room.roomState !== 'waiting_continue' || !isMultiplayerContinue(room)) {
    return false;
  }
  return localContinuePressed(room) && !allContinuePressed(room);
}
