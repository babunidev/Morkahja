import type {
  ContinueReadinessDto,
  EncounterRoomSnapshotDto,
  ParticipantPreparedResultDto,
  RoomParticipantDto,
} from '../../api/http.js';

function engagedParticipants(room: EncounterRoomSnapshotDto): RoomParticipantDto[] {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
}

function isPostSystemEventContinue(room: EncounterRoomSnapshotDto): boolean {
  return room.systemEvent?.lastEventRecap !== undefined;
}

/** True when a system-event actor outcome is ready to mirror for witnesses. */
export function hasWitnessableOutcome(
  outcome: ParticipantPreparedResultDto | undefined,
): boolean {
  if (!outcome) {
    return false;
  }

  return (
    outcome.selectedRoll !== undefined
    || (outcome.rewards?.length ?? 0) > 0
    || outcome.leveledUp === true
  );
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

const INACTIVE_OUTCOME_MESSAGE = 'Inactive';

function localHasRevealedOutcome(room: EncounterRoomSnapshotDto): boolean {
  const local = room.participants.find((participant) => participant.isLocal);
  if (!local) {
    return false;
  }

  const summary = local.preparedResult ?? local.resolutionSummary;
  if (!summary) {
    return false;
  }

  if (summary.message === INACTIVE_OUTCOME_MESSAGE && local.choiceState === 'disengaged') {
    return false;
  }

  return true;
}

/** True when the server avatar inventory is authoritative (post-commit), not a pre-continue preview. */
export function shouldApplyServerInventory(
  room: EncounterRoomSnapshotDto,
  localParticipant: RoomParticipantDto | undefined,
): boolean {
  if (!localParticipant) {
    return false;
  }

  if (
    room.roomState === 'system_event'
    || room.roomState === 'advancing'
    || room.roomState === 'active_encounter'
  ) {
    return true;
  }

  if (room.roomState === 'waiting_continue') {
    return localParticipant.preparedResult === undefined;
  }

  return false;
}

/** Keep reward/loss UI visible until the room advances to the next encounter snapshot. */
export function shouldDeferRewardDismiss(
  room: EncounterRoomSnapshotDto | null | undefined,
  resultsVisible: boolean,
): boolean {
  if (!room || !resultsVisible || !localHasRevealedOutcome(room)) {
    return false;
  }

  if (
    room.roomState === 'waiting_continue'
    || room.roomState === 'advancing'
  ) {
    return true;
  }

  const local = room.participants.find((participant) => participant.isLocal);
  return local?.preparedResult !== undefined || local?.choiceState === 'ready_to_continue';
}

export function localContinuePressed(room: EncounterRoomSnapshotDto): boolean {
  const local = room.participants.find((participant) => participant.isLocal);
  return local?.continuePressed === true;
}

/** Local player has submitted their encounter choice to the server. */
export function localOutcomeCommitted(room: EncounterRoomSnapshotDto): boolean {
  const local = room.participants.find((participant) => participant.isLocal);
  if (!local) {
    return false;
  }

  return (
    local.choiceState === 'ready_to_continue' ||
    local.choiceState === 'resolved' ||
    local.preparedResult !== undefined
  );
}

/** Room is waiting to continue and local still needs to send continuePressed. */
export function localNeedsContinueAck(room: EncounterRoomSnapshotDto): boolean {
  if (!localOutcomeCommitted(room) || localContinuePressed(room)) {
    return false;
  }

  return room.roomState === 'waiting_continue' || room.roomState === 'advancing';
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

/** True when the system-event actor may press Continue on the result row. */
export function actorCanPressContinue(
  room: EncounterRoomSnapshotDto | null | undefined,
): boolean {
  if (!room || room.systemEvent?.isLocalActor !== true) {
    return false;
  }

  const local = room.participants.find((participant) => participant.isLocal);
  if (!local) {
    return false;
  }

  if (room.roomState === 'system_event') {
    return (
      local.choiceState === 'ready_to_continue'
      && local.preparedResult !== undefined
    );
  }

  if (room.roomState === 'waiting_continue' || room.roomState === 'advancing') {
    return localNeedsContinueAck(room);
  }

  return false;
}
