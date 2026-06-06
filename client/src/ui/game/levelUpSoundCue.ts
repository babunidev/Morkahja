import type { EncounterRoomSnapshotDto } from '../../api/http.js';

const LEVEL_UP_ENCOUNTER_ID = 2;

function isLevelUpEncounterVisible(room: EncounterRoomSnapshotDto): boolean {
  return room.roomState === 'system_event'
    && room.activeEncounter.encounterId === LEVEL_UP_ENCOUNTER_ID
    && (
      room.systemEvent?.kind === 'level_up'
      || room.systemEvent?.encounterId === LEVEL_UP_ENCOUNTER_ID
    );
}

/** True the first time this level-up system-event snapshot is shown in the room. */
export function levelUpEncounterJustBecameVisible(
  previousRoom: EncounterRoomSnapshotDto | null,
  nextRoom: EncounterRoomSnapshotDto,
): boolean {
  if (!isLevelUpEncounterVisible(nextRoom)) {
    return false;
  }

  if (
    previousRoom
    && previousRoom.roomId === nextRoom.roomId
    && previousRoom.activeEncounter.snapshotId === nextRoom.activeEncounter.snapshotId
    && isLevelUpEncounterVisible(previousRoom)
  ) {
    return false;
  }

  return true;
}

export function levelUpSoundKeyForRoom(nextRoom: EncounterRoomSnapshotDto): string {
  return `${nextRoom.roomId}:${nextRoom.activeEncounter.snapshotId}:level-up-visible`;
}

export function shouldPlayLevelUpSound(
  previousRoom: EncounterRoomSnapshotDto | null,
  nextRoom: EncounterRoomSnapshotDto,
  playedKeys: ReadonlySet<string>,
): string | null {
  if (!levelUpEncounterJustBecameVisible(previousRoom, nextRoom)) {
    return null;
  }

  const key = levelUpSoundKeyForRoom(nextRoom);
  return playedKeys.has(key) ? null : key;
}
