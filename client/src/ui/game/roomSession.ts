import {
  createEncounterRoom,
  leaveAllEncounterRooms,
  processRoomAway,
  type EncounterRoomSnapshotDto,
} from '../../api/http.js';

export function localParticipant(
  room: EncounterRoomSnapshotDto,
): EncounterRoomSnapshotDto['participants'][number] | undefined {
  return room.participants.find((participant) => participant.isLocal);
}

/** Avatar selection / solo Play — server createRoom owns leave + solo restore logic. */
export async function ensureSoloLeaderRoom(avatarId: string): Promise<EncounterRoomSnapshotDto> {
  return createEncounterRoom(avatarId);
}

export async function leaveAllRoomsForDashboard(activeAvatarId?: string): Promise<void> {
  try {
    if (activeAvatarId) {
      await processRoomAway(activeAvatarId);
    }
    await leaveAllEncounterRooms();
  } catch (error) {
    console.error('Failed to leave all rooms for dashboard', error);
  }
}
