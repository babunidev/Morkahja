import type { EncounterRoomSnapshotDto } from '../../api/http.js';
import { DEATH_ENCOUNTER_ID } from '@shared/deathEncounter';

const LEVEL_UP_ENCOUNTER_ID = 2;

function isSystemEventVisible(
  room: EncounterRoomSnapshotDto,
  encounterId: number,
  kind: 'level_up' | 'atranor',
): boolean {
  return room.roomState === 'system_event'
    && room.activeEncounter.encounterId === encounterId
    && (
      room.systemEvent?.kind === kind
      || room.systemEvent?.encounterId === encounterId
    );
}

function isLevelUpEncounterVisible(room: EncounterRoomSnapshotDto): boolean {
  return isSystemEventVisible(room, LEVEL_UP_ENCOUNTER_ID, 'level_up');
}

function isAtranorEncounterVisible(room: EncounterRoomSnapshotDto): boolean {
  return isSystemEventVisible(room, DEATH_ENCOUNTER_ID, 'atranor');
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

/**
 * Atranor (Babuni, 2026-11-23): its own sound plays once for everyone in the
 * room when a fallen avatar enters Atranor, the one judged and the witnesses.
 */
export function shouldPlayAtranorSound(
  previousRoom: EncounterRoomSnapshotDto | null,
  nextRoom: EncounterRoomSnapshotDto,
  playedKeys: ReadonlySet<string>,
): string | null {
  if (!isAtranorEncounterVisible(nextRoom)) {
    return null;
  }
  if (
    previousRoom
    && previousRoom.roomId === nextRoom.roomId
    && previousRoom.activeEncounter.snapshotId === nextRoom.activeEncounter.snapshotId
    && isAtranorEncounterVisible(previousRoom)
  ) {
    return null;
  }

  const key = `${nextRoom.roomId}:${nextRoom.activeEncounter.snapshotId}:atranor-visible`;
  return playedKeys.has(key) ? null : key;
}
