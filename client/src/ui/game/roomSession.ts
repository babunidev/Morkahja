import {
  createEncounterRoom,
  leaveAllEncounterRooms,
  type EncounterRoomSnapshotDto,
} from '../../api/http.js';

export function localParticipant(
  room: EncounterRoomSnapshotDto,
): EncounterRoomSnapshotDto['participants'][number] | undefined {
  return room.participants.find((participant) => participant.isLocal);
}

/** True when the local player joined someone else's room (Player 2 or 3). */
export function isJoinedPartyRoom(room: EncounterRoomSnapshotDto): boolean {
  const local = localParticipant(room);
  return local !== undefined && local.slotIndex !== 0;
}

/** True when the local player leads their own room (Player 1 / left slot). */
export function isOwnLeaderRoom(room: EncounterRoomSnapshotDto): boolean {
  const local = localParticipant(room);
  return local !== undefined && local.slotIndex === 0;
}

/** Avatar selection / solo Play — server createRoom owns leave + solo restore logic. */
export async function ensureSoloLeaderRoom(avatarId: string): Promise<EncounterRoomSnapshotDto> {
  return createEncounterRoom(avatarId);
}

export async function leaveAllRoomsForDashboard(): Promise<void> {
  try {
    await leaveAllEncounterRooms();
  } catch (error) {
    console.error('Failed to leave all rooms for dashboard', error);
  }
}
