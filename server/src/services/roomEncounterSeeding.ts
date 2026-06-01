import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import type { EncounterData } from '../engine/types.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import {
  alignSnapshotToRoomShell,
  bindSnapshotToParticipant,
  buildSlotEncounterSnapshots,
  prepareNextEncounter,
  type SlotEncounterSnapshots,
} from './encounterGenerator.js';
import { loadAvatar, saveActiveEncounter } from './encounterPersistence.js';
import { getEncounterById } from './gameData.js';
import { saveEncounterRoom } from './roomPersistence.js';

function nowMs(): number {
  return Date.now();
}

function findParticipant(room: EncounterRoom, playerId: string): RoomParticipant | undefined {
  return room.participants.find((participant) => participant.playerId === playerId);
}

async function buildSlotSnapshotsForRoom(
  room: EncounterRoom,
  encounter: EncounterData,
  preparedEncounter: ReturnType<typeof prepareNextEncounter>,
): Promise<SlotEncounterSnapshots> {
  const leader = findParticipant(room, room.leaderPlayerId)
    ?? room.participants[0];
  if (!leader) {
    throw new Error('Room has no leader');
  }

  const leaderAvatar = await loadAvatar(leader.playerId, leader.avatarId) ?? undefined;
  const avatarByParticipantKey = new Map<string, AvatarDocument>();
  for (const participant of room.participants) {
    const avatar = await loadAvatar(participant.playerId, participant.avatarId);
    if (avatar) {
      avatarByParticipantKey.set(
        `${participant.playerId}:${participant.avatarId}`,
        avatar,
      );
    }
  }

  const participantRefs = room.participants.map((participant) => ({
    slotIndex: participant.slotIndex,
    playerId: participant.playerId,
    avatarId: participant.avatarId,
  }));

  return buildSlotEncounterSnapshots(
    encounter,
    preparedEncounter,
    room.roomId,
    leader.playerId,
    leader.avatarId,
    leaderAvatar,
    participantRefs,
    (playerId, avatarId) =>
      avatarByParticipantKey.get(`${playerId}:${avatarId}`) ?? leaderAvatar,
  );
}

function roomWithSlotEncounterSnapshots(
  room: EncounterRoom,
  slotEncounterSnapshots: SlotEncounterSnapshots,
  shellSnapshot: EncounterSnapshot,
): EncounterRoom {
  const alignedSlots = slotEncounterSnapshots.map((snapshot) =>
    alignSnapshotToRoomShell(shellSnapshot, {
      ...snapshot,
      loreGemOffer: shellSnapshot.loreGemOffer,
    }),
  ) as SlotEncounterSnapshots;

  return {
    ...room,
    activeEncounterSnapshot: shellSnapshot,
    slotEncounterSnapshots: alignedSlots,
    updatedAt: nowMs(),
  };
}

export async function syncActiveEncountersForRoom(room: EncounterRoom): Promise<void> {
  for (const participant of room.participants) {
    if (participant.choiceState === 'disengaged') {
      continue;
    }

    await saveActiveEncounter(
      bindSnapshotToParticipant(
        room.slotEncounterSnapshots[participant.slotIndex],
        participant.playerId,
        participant.avatarId,
      ),
    );
  }
}

export async function seedAllSlotEncountersForRoom(
  room: EncounterRoom,
  encounter: EncounterData,
  preparedEncounter: ReturnType<typeof prepareNextEncounter>,
): Promise<EncounterRoom> {
  const slotEncounterSnapshots = await buildSlotSnapshotsForRoom(
    room,
    encounter,
    preparedEncounter,
  );
  const shellSnapshot: EncounterSnapshot = {
    ...slotEncounterSnapshots[0],
    roomId: room.roomId,
    state: 'active',
    loreGemOffer: room.activeEncounterSnapshot.loreGemOffer,
  };

  return roomWithSlotEncounterSnapshots(room, slotEncounterSnapshots, shellSnapshot);
}

export async function ensureSlotEncounterSnapshots(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.slotEncounterSnapshots?.length === 3) {
    return room;
  }

  const encounter = getEncounterById(room.activeEncounterSnapshot.encounterId);
  if (!encounter) {
    return room;
  }

  const preparedEncounter = room.activeEncounterSnapshot.preparedEncounter
    ?? prepareNextEncounter(encounter, room.mergedExpansions);
  const seeded = await seedAllSlotEncountersForRoom(room, encounter, preparedEncounter);
  await saveEncounterRoom(seeded);
  await syncActiveEncountersForRoom(seeded);
  return seeded;
}

export function snapshotForParticipant(
  room: EncounterRoom,
  participant: RoomParticipant,
): EncounterSnapshot {
  return room.slotEncounterSnapshots[participant.slotIndex];
}

export function localSlotSnapshotForPlayer(
  room: EncounterRoom,
  playerId: string,
  avatarId: string,
): EncounterSnapshot {
  const localParticipant = room.participants.find(
    (participant) => participant.playerId === playerId && participant.avatarId === avatarId,
  );
  const slotIndex = localParticipant?.slotIndex ?? 0;
  return bindSnapshotToParticipant(
    room.slotEncounterSnapshots[slotIndex],
    playerId,
    avatarId,
  );
}
