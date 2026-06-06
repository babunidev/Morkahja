import type {
  EncounterRoomSnapshotDto,
  ParticipantPreparedResultDto,
  RoomParticipantDto,
} from '../../api/http.js';
import { hasWitnessableOutcome } from './roomContinue.js';

export interface WitnessSystemEventDisplay {
  isWitness: boolean;
  actor: RoomParticipantDto | undefined;
  outcome: ParticipantPreparedResultDto | undefined;
  showWaitingLabel: boolean;
  showActorResult: boolean;
  /** Witness may press Continue once the room is waiting for the party. */
  witnessCanContinue: boolean;
}

function actorHasCommittedRoll(actor: RoomParticipantDto | undefined): boolean {
  if (!actor) {
    return false;
  }

  return (
    actor.preparedResult !== undefined
    || actor.resolutionSummary !== undefined
    || actor.choiceState === 'ready_to_continue'
    || actor.choiceState === 'resolved'
  );
}

/** True when the actor has rolled and their outcome is visible to the actor client. */
function actorOutcomeRevealed(
  room: EncounterRoomSnapshotDto,
  actor: RoomParticipantDto | undefined,
  outcome: ParticipantPreparedResultDto | undefined,
): boolean {
  if (!hasWitnessableOutcome(outcome)) {
    return false;
  }

  // Server pushes actorOutcome as soon as the actor rolls — trust it immediately.
  if (room.systemEvent?.actorOutcome !== undefined) {
    return true;
  }

  if (room.roomState === 'system_event') {
    return actorHasCommittedRoll(actor);
  }

  if (room.roomState === 'waiting_continue' && room.systemEvent) {
    return true;
  }

  return false;
}

/**
 * Derives witness UI state from the room snapshot (server is source of truth).
 * Prefer `systemEvent.actorOutcome` when present — it is populated for witnesses on the server.
 */
export function witnessSystemEventDisplay(
  room: EncounterRoomSnapshotDto | null | undefined,
): WitnessSystemEventDisplay {
  const empty: WitnessSystemEventDisplay = {
    isWitness: false,
    actor: undefined,
    outcome: undefined,
    showWaitingLabel: false,
    showActorResult: false,
    witnessCanContinue: false,
  };

  if (!room?.systemEvent) {
    return empty;
  }

  const local = room.participants.find((participant) => participant.isLocal);
  const isWitness = room.systemEvent.isLocalWitness === true
    || local?.choiceState === 'witnessing';

  if (!isWitness) {
    return empty;
  }

  const actor = room.participants.find(
    (participant) => participant.playerId === room.systemEvent!.actorPlayerId,
  );
  const outcome = room.systemEvent.actorOutcome
    ?? actor?.preparedResult
    ?? actor?.resolutionSummary
    ?? room.systemEvent.lastEventRecap;

  const inWitnessFlow = room.roomState === 'system_event'
    || (room.roomState === 'waiting_continue' && room.systemEvent !== undefined);

  const showActorResult = inWitnessFlow && actorOutcomeRevealed(room, actor, outcome);
  const showWaitingLabel = inWitnessFlow && !showActorResult;
  const witnessCanContinue = showActorResult && room.roomState === 'waiting_continue';

  return {
    isWitness,
    actor,
    outcome,
    showWaitingLabel,
    showActorResult,
    witnessCanContinue,
  };
}
