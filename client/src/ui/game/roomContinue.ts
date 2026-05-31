import type {
  ContinueReadinessDto,
  EncounterRoomSnapshotDto,
  RoomParticipantDto,
} from '../../api/http.js';

function engagedParticipants(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
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

/** Mirrors server `continueTargetsForRoom` for UI hints only. */
export function continueTargets(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  if (isPostSystemEventContinue(room)) {
    return engagedParticipants(room);
  }

  const awaitingContinue = engagedParticipants(room).filter(
    (participant) =>
      participant.choiceState === 'ready_to_continue' ||
      participant.choiceState === 'resolved',
  );
  return awaitingContinue.length > 0 ? awaitingContinue : engagedParticipants(room);
}

export function isMultiplayerContinue(room: EncounterRoomSnapshotDto | null | undefined): boolean {
  return isPartySession(room);
}

export function shouldDeferRewardDismiss(
  room: EncounterRoomSnapshotDto | null | undefined,
  resultsVisible: boolean,
): boolean {
  if (!room || !resultsVisible) {
    return false;
  }

  if (room.roomState === 'advancing') {
    return false;
  }

  if (!isPartySession(room)) {
    return false;
  }

  if (room.roomState === 'waiting_continue') {
    return true;
  }

  const local = room.participants.find((participant) => participant.isLocal);
  return local?.preparedResult !== undefined || local?.choiceState === 'ready_to_continue';
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
): boolean {
  if (!isPartySession(room) || room?.roomState !== 'waiting_continue') {
    return false;
  }

  return localContinuePressed(room) && !allContinuePressed(room);
}

export function continueReadinessClass(
  readiness: ContinueReadinessDto | undefined,
): string | undefined {
  if (readiness === 'gathering') {
    return 'morkahja-continue-glow-gathering';
  }
  if (readiness === 'awaiting_local') {
    return 'morkahja-continue-glow-awaiting-you';
  }
  return undefined;
}

/** Forest-green glow when every continue target has pressed Continue. */
export function continueGlowClassForRoom(
  room: EncounterRoomSnapshotDto | null | undefined,
): string | undefined {
  if (!room || (room.roomState !== 'waiting_continue' && room.roomState !== 'advancing')) {
    return undefined;
  }

  if (canAdvanceRoomHint(room)) {
    return 'morkahja-continue-glow-ready';
  }

  return continueReadinessClass(room.continueReadiness);
}

/** UI-only mirror of server `canAdvanceRoom` — not authoritative. */
export function canAdvanceRoomHint(room: EncounterRoomSnapshotDto): boolean {
  const targets = continueTargets(room);
  if (targets.some((participant) => participant.focusState !== 'none')) {
    return false;
  }
  return targets.every((participant) => participant.continuePressed);
}

/** Local player pressed Continue and the room has not advanced yet. */
export function localWaitingForRoomAdvance(
  room: EncounterRoomSnapshotDto | null | undefined,
): boolean {
  if (!room || !localContinuePressed(room)) {
    return false;
  }

  return room.roomState === 'waiting_continue' || room.roomState === 'advancing';
}
