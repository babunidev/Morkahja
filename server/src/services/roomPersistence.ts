import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { PlayerPresence } from '../domain/rooms/PlayerPresence.js';
import type { RoomInvitation } from '../domain/rooms/RoomInvitation.js';
import {
  deleteEncounterRoom,
  findRoomIdByParticipant,
  findRoomIdByParticipantAvatar,
  listOpenRoomIdsByParticipant,
  getEncounterRoom,
  getPlayerPresence,
  getRoomInvitation,
  listPendingInvitationsForPlayer,
  setEncounterRoom,
  setPlayerPresence,
  setRoomInvitation,
} from '../db/postgresDocumentStore.js';

export function normalizeEncounterRoom(room: EncounterRoom): EncounterRoom {
  if ((room.roomState as string) === 'active') {
    return {
      ...room,
      roomState: 'active_encounter',
    };
  }

  return room;
}

export async function loadEncounterRoom(roomId: string): Promise<EncounterRoom | null> {
  const room = await getEncounterRoom<EncounterRoom>(roomId);
  if (!room) {
    return null;
  }

  return normalizeEncounterRoom(room);
}

export async function saveEncounterRoom(room: EncounterRoom): Promise<void> {
  await setEncounterRoom(room.roomId, room);
}

export async function removeEncounterRoom(roomId: string): Promise<void> {
  await deleteEncounterRoom(roomId);
}

export async function findActiveRoomIdForPlayer(playerId: string): Promise<string | null> {
  return findRoomIdByParticipant(playerId);
}

export async function findActiveRoomIdForPlayerAvatar(
  playerId: string,
  avatarId: string,
): Promise<string | null> {
  return findRoomIdByParticipantAvatar(playerId, avatarId);
}

export async function listActiveRoomIdsForPlayer(playerId: string): Promise<string[]> {
  return listOpenRoomIdsByParticipant(playerId);
}

export async function loadPlayerPresence(playerId: string): Promise<PlayerPresence | null> {
  return getPlayerPresence<PlayerPresence>(playerId);
}

export async function savePlayerPresence(presence: PlayerPresence): Promise<void> {
  await setPlayerPresence(presence.playerId, presence);
}

export async function loadRoomInvitation(inviteId: string): Promise<RoomInvitation | null> {
  return getRoomInvitation<RoomInvitation>(inviteId);
}

export async function saveRoomInvitation(invitation: RoomInvitation): Promise<void> {
  await setRoomInvitation(invitation.inviteId, invitation);
}

export async function loadPendingInvitations(playerId: string): Promise<RoomInvitation[]> {
  return listPendingInvitationsForPlayer<RoomInvitation>(playerId);
}
