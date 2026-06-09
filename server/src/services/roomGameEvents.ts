import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomInvitation } from '../domain/rooms/RoomInvitation.js';
import {
  formatAvatarDisplayName,
  readAvatarDisplayTitle,
} from '../domain/achievements/achievementTitles.js';
import { loadAvatar } from './encounterPersistence.js';
import { shouldPublishRoomEncounterScribe } from '../domain/news/roomEncounterScribePolicy.js';
import { recordGameEvent } from './gameEventService.js';

async function leaderAvatarPayload(
  room: EncounterRoom,
  leaderPlayerId: string,
): Promise<Record<string, unknown>> {
  const leader = room.participants.find((participant) => participant.playerId === leaderPlayerId);
  const avatar = leader
    ? await loadAvatar(leaderPlayerId, leader.avatarId)
    : null;

  return {
    roomId: room.roomId,
    encounterId: room.activeEncounterSnapshot.encounterId,
    encounterTitle: room.activeEncounterSnapshot.encounterTitle,
    ...(avatar
      ? {
          avatarName: formatAvatarDisplayName(
            avatar.name?.trim() || 'Adventurer',
            readAvatarDisplayTitle(avatar),
          ),
          ...(avatar.portrait ? { avatarPortrait: avatar.portrait } : {}),
          ...(avatar.frame ? { avatarFrame: avatar.frame } : {}),
        }
      : {}),
  };
}

export async function recordRoomCreatedEvent(
  playerId: string,
  room: EncounterRoom,
): Promise<void> {
  await recordGameEvent({
    playerId,
    avatarId: room.participants.find((participant) => participant.playerId === playerId)?.avatarId,
    type: 'room_created',
    visibility: 'friends',
    importance: 'low',
    payload: await leaderAvatarPayload(room, playerId),
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
      ...(await leaderAvatarPayload(room, room.leaderPlayerId)),
      participantCount: room.participants.filter((p) => p.choiceState !== 'disengaged').length,
    },
  });
}

export async function maybeRecordRoomEncounterStartedEvent(
  room: EncounterRoom,
): Promise<void> {
  const leader = room.participants.find((participant) => participant.playerId === room.leaderPlayerId);
  if (!leader) {
    return;
  }

  const avatar = await loadAvatar(room.leaderPlayerId, leader.avatarId);
  const encountersCompleted = avatar?.progression?.encountersCompleted;
  const completedCount = typeof encountersCompleted === 'number' ? encountersCompleted : undefined;
  if (!shouldPublishRoomEncounterScribe(completedCount)) {
    return;
  }

  await recordRoomEncounterStartedEvent(room);
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

export async function recordHelpCalledEvent(
  fromPlayerId: string,
  room: EncounterRoom,
  context: {
    fromPlayerName?: string;
    avatarName?: string;
    avatarPortrait?: string;
    avatarFrame?: string;
  },
): Promise<void> {
  await recordGameEvent({
    playerId: fromPlayerId,
    type: 'help_called',
    visibility: 'friends',
    importance: 'high',
    payload: {
      roomId: room.roomId,
      encounterId: room.activeEncounterSnapshot.encounterId,
      encounterTitle: room.activeEncounterSnapshot.encounterTitle,
      playerName: context.fromPlayerName,
      avatarName: context.avatarName,
      snapshotId: room.activeEncounterSnapshot.snapshotId,
      ...(context.avatarPortrait ? { avatarPortrait: context.avatarPortrait } : {}),
      ...(context.avatarFrame ? { avatarFrame: context.avatarFrame } : {}),
    },
  });
}

export async function recordHelpRequestedEvent(
  fromPlayerId: string,
  toPlayerId: string,
  roomId: string,
  inviteId: string,
  context: {
    encounterId: number;
    encounterTitle?: string;
    fromPlayerName?: string;
    avatarName?: string;
    avatarPortrait?: string;
    avatarFrame?: string;
  },
): Promise<void> {
  await recordGameEvent({
    playerId: fromPlayerId,
    type: 'help_requested',
    visibility: 'friends',
    importance: 'high',
    payload: {
      roomId,
      toPlayerId,
      inviteId,
      encounterId: context.encounterId,
      encounterTitle: context.encounterTitle,
      playerName: context.fromPlayerName,
      ...(context.avatarName ? { avatarName: context.avatarName } : {}),
      ...(context.avatarPortrait ? { avatarPortrait: context.avatarPortrait } : {}),
      ...(context.avatarFrame ? { avatarFrame: context.avatarFrame } : {}),
    },
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
