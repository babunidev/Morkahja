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
}

/** Mirrors when the actor client would show a prepared/resolved system-event outcome. */
function actorOutcomeRevealed(
  room: EncounterRoomSnapshotDto,
  actor: RoomParticipantDto | undefined,
  outcome: ParticipantPreparedResultDto | undefined,
): boolean {
  if (!actor || !hasWitnessableOutcome(outcome)) {
    return false;
  }

  if (room.roomState === 'system_event') {
    return (
      actor.choiceState === 'ready_to_continue'
      || actor.choiceState === 'resolved'
    );
  }

  if (room.roomState === 'waiting_continue') {
    return room.systemEvent?.lastEventRecap !== undefined;
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
    || (room.roomState === 'waiting_continue' && room.systemEvent.lastEventRecap !== undefined);

  const showActorResult = inWitnessFlow && actorOutcomeRevealed(room, actor, outcome);
  const showWaitingLabel = inWitnessFlow && !showActorResult;

  return {
    isWitness,
    actor,
    outcome,
    showWaitingLabel,
    showActorResult,
  };
}
