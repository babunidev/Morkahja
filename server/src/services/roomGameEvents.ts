import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomInvitation } from '../domain/rooms/RoomInvitation.js';
import { recordGameEvent } from './gameEventService.js';

export async function recordRoomCreatedEvent(
  playerId: string,
  room: EncounterRoom,
): Promise<void> {
  await recordGameEvent({
    playerId,
    type: 'room_created',
    visibility: 'friends',
    importance: 'low',
    payload: {
      roomId: room.roomId,
      encounterId: room.activeEncounterSnapshot.encounterId,
    },
  });
}

export async function recordPlayerJoinedRoomEvent(
  playerId: string,
  avatarId: string,
  room: EncounterRoom,
): Promise<void> {
  await recordGameEvent({
    playerId,
    avatarId,
    type: 'player_joined_room',
    visibility: 'friends',
    importance: 'medium',
    payload: {
      roomId: room.roomId,
      encounterId: room.activeEncounterSnapshot.encounterId,
    },
  });
}

export async function recordPlayerDisengagedEvent(
  playerId: string,
  avatarId: string,
  roomId: string,
): Promise<void> {
  await recordGameEvent({
    playerId,
    avatarId,
    type: 'player_disengaged',
    visibility: 'friends',
    importance: 'low',
    payload: { roomId },
  });
}

export async function recordRoomEncounterStartedEvent(
  room: EncounterRoom,
): Promise<void> {
  const leader = room.participants.find((p) => p.playerId === room.leaderPlayerId);
  await recordGameEvent({
    playerId: room.leaderPlayerId,
    avatarId: leader?.avatarId,
    type: 'room_encounter_started',
    visibility: 'global',
    importance: 'medium',
    payload: {
      roomId: room.roomId,
      encounterId: room.activeEncounterSnapshot.encounterId,
      encounterTitle: room.activeEncounterSnapshot.encounterTitle,
      participantCount: room.participants.filter((p) => p.choiceState !== 'disengaged').length,
    },
  });
}

export async function recordRoomEncounterResolvedEvent(
  room: EncounterRoom,
): Promise<void> {
  await recordGameEvent({
    playerId: room.leaderPlayerId,
    type: 'room_encounter_resolved',
    visibility: 'global',
    importance: 'medium',
    payload: {
      roomId: room.roomId,
      encounterId: room.activeEncounterSnapshot.encounterId,
    },
  });
}

export async function recordHelpRequestedEvent(
  fromPlayerId: string,
  toPlayerId: string,
  roomId: string,
): Promise<void> {
  await recordGameEvent({
    playerId: fromPlayerId,
    type: 'help_requested',
    visibility: 'friends',
    importance: 'low',
    payload: { roomId, toPlayerId },
  });
}

export async function recordHelpJoinedEvent(
  playerId: string,
  avatarId: string,
  roomId: string,
): Promise<void> {
  await recordGameEvent({
    playerId,
    avatarId,
    type: 'help_joined',
    visibility: 'friends',
    importance: 'medium',
    payload: { roomId },
  });
}
