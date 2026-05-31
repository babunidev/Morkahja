import {
  createEncounterRoom,
  fetchActiveRoom,
  fetchAvatar,
  leaveEncounterRoom,
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

export async function leaveJoinedPartyRoomIfNeeded(avatarId: string): Promise<boolean> {
  const room = await fetchActiveRoom(avatarId);
  if (!room || !isJoinedPartyRoom(room)) {
    return false;
  }

  await leaveEncounterRoom(avatarId);
  return true;
}

/** Leave joined rooms and reuse or create a solo leader room on slot 0. */
export async function ensureSoloLeaderRoom(avatarId: string): Promise<EncounterRoomSnapshotDto> {
  const active = await fetchActiveRoom(avatarId);
  if (active) {
    if (isJoinedPartyRoom(active)) {
      await leaveEncounterRoom(avatarId);
    } else if (isOwnLeaderRoom(active)) {
      return active;
    }
  }

  return createEncounterRoom(avatarId);
}

export async function resolveDashboardLeaveAvatarId(): Promise<string | undefined> {
  const response = await fetchAvatar(null);
  return response.avatar?.id;
}

export async function leaveJoinedRoomForDashboard(avatarId: string | undefined): Promise<void> {
  if (!avatarId) {
    return;
  }

  try {
    await leaveJoinedPartyRoomIfNeeded(avatarId);
  } catch (error) {
    console.error('Failed to leave joined room for dashboard', error);
  }
}
