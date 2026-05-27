import type {
  EncounterRoomSnapshotDto,
  EncounterSnapshotDto,
  RoomParticipantDto,
  RoomSystemEventDto,
} from '../../../shared/src/contracts.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { getPlayer } from '../db/postgresDocumentStore.js';
import { loadAvatar } from './encounterPersistence.js';
import { toPersistedAvatarDto } from './avatarPresentation.js';
import type { PlayerDocument } from '../types/player.js';

const FALLBACK_PORTRAIT = 'im_avatar_rokur_m_01.webp';
const FALLBACK_FRAME = 'im_frame_01.webp';

const loggedParticipantFallbacks = new Set<string>();

function toEncounterSnapshotDto(snapshot: EncounterSnapshot): EncounterSnapshotDto {
  return {
    snapshotId: snapshot.snapshotId,
    encounterId: snapshot.encounterId,
    encounterTitle: snapshot.encounterTitle,
    encounterImageName: snapshot.encounterImageName,
    encounterText: snapshot.encounterText,
    encounterDifficulty: snapshot.encounterDifficulty,
    primarySolutionA: snapshot.primarySolutionA,
    primarySolutionB: snapshot.primarySolutionB,
    primarySolutionC: snapshot.primarySolutionC,
    primarySolutionD: snapshot.primarySolutionD,
    secondarySolutionTypeA: snapshot.secondarySolutionTypeA,
    secondarySolutionTypeB: snapshot.secondarySolutionTypeB,
    secondarySolutionTypeC: snapshot.secondarySolutionTypeC,
    secondarySolutionTypeD: snapshot.secondarySolutionTypeD,
    rollA: snapshot.rollA,
    rollB: snapshot.rollB,
    rollC: snapshot.rollC,
    rollD: snapshot.rollD,
    rollPrimaryA: snapshot.rollPrimaryA,
    rollPrimaryB: snapshot.rollPrimaryB,
    rollPrimaryC: snapshot.rollPrimaryC,
    rollPrimaryD: snapshot.rollPrimaryD,
    rollSecondaryA: snapshot.rollSecondaryA,
    rollSecondaryB: snapshot.rollSecondaryB,
    rollSecondaryC: snapshot.rollSecondaryC,
    rollSecondaryD: snapshot.rollSecondaryD,
    rollE: snapshot.rollE,
    rewardIds: snapshot.rewardIds,
    prosperityRewardId: snapshot.prosperityRewardId,
    preparedEncounter: snapshot.preparedEncounter,
    state: snapshot.state,
    resolved: snapshot.resolved,
  };
}

async function readPlayerName(playerId: string): Promise<string> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const name = player?.playerName?.trim();
  return name && name.length > 0 ? name : playerId;
}

function buildParticipantDto(
  participant: RoomParticipant,
  localPlayerId: string,
  playerName: string,
  avatar: RoomParticipantDto['avatar'],
): RoomParticipantDto {
  return {
    playerId: participant.playerId,
    avatarId: participant.avatarId,
    slotIndex: participant.slotIndex,
    playerName,
    avatar,
    choiceState: participant.choiceState,
    focusState: participant.focusState,
    selectedSolutionId: participant.selectedSolutionId,
    continuePressed: participant.continuePressed,
    resolutionSummary: participant.resolutionSummary,
    isLocal: participant.playerId === localPlayerId,
  };
}

async function participantToDto(
  participant: RoomParticipant,
  localPlayerId: string,
  roomId: string,
): Promise<RoomParticipantDto> {
  const playerName = await readPlayerName(participant.playerId);
  const avatar = await loadAvatar(participant.playerId, participant.avatarId);
  const dto = avatar ? toPersistedAvatarDto(avatar) : null;

  if (dto) {
    return buildParticipantDto(participant, localPlayerId, playerName, dto);
  }

  const fallbackKey = `${roomId}:${participant.playerId}:${participant.avatarId}`;
  if (!loggedParticipantFallbacks.has(fallbackKey)) {
    loggedParticipantFallbacks.add(fallbackKey);
    console.warn(
      `[roomDtoMapper] Using placeholder avatar for participant ${participant.playerId} in room ${roomId}`,
    );
  }

  return buildParticipantDto(participant, localPlayerId, playerName, {
    id: participant.avatarId,
    name: playerName,
    race: 'Rokur',
    role: 'Mage',
    level: 1,
    experience: 0,
    portrait: FALLBACK_PORTRAIT,
    frame: FALLBACK_FRAME,
    displayTitle: null,
  });
}

function currentSystemEventActorId(room: EncounterRoom): string | undefined {
  const item = room.systemEvent?.queue[room.systemEvent.queueIndex];
  return item?.actorPlayerId;
}

function toSystemEventDto(
  room: EncounterRoom,
  localPlayerId: string,
): RoomSystemEventDto | undefined {
  const context = room.systemEvent;
  if (!context) {
    return undefined;
  }

  const actorPlayerId = currentSystemEventActorId(room)
    ?? context.lastEvent?.actorPlayerId;
  if (!actorPlayerId) {
    return undefined;
  }

  const currentItem = context.queue[context.queueIndex];
  const encounterId = currentItem?.encounterId
    ?? (context.lastEvent?.kind === 'level_up'
      ? LEVEL_UP_ENCOUNTER_NUMERIC_ID
      : DEATH_ENCOUNTER_NUMERIC_ID);
  const kind = encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID ? 'level_up' : 'atranor';

  return {
    actorPlayerId,
    encounterId,
    kind,
    isLocalActor: localPlayerId === actorPlayerId,
    isLocalWitness: localPlayerId !== actorPlayerId && room.roomState === 'system_event',
    lastEventRecap: context.lastEvent?.resolutionSummary,
  };
}

export async function toEncounterRoomSnapshotDto(
  room: EncounterRoom,
  localPlayerId: string,
): Promise<EncounterRoomSnapshotDto> {
  const participantDtos = await Promise.all(
    room.participants.map((participant) => participantToDto(participant, localPlayerId, room.roomId)),
  );

  participantDtos.sort((a, b) => a.slotIndex - b.slotIndex);

  return {
    roomId: room.roomId,
    leaderPlayerId: room.leaderPlayerId,
    roomState: room.roomState,
    slotStates: room.slotStates,
    participants: participantDtos,
    activeEncounter: toEncounterSnapshotDto(room.activeEncounterSnapshot),
    helpCalledForEncounter:
      room.helpCalledSnapshotId === room.activeEncounterSnapshot.snapshotId,
    systemEvent: toSystemEventDto(room, localPlayerId),
    lineageEncounterId: room.systemEvent?.lineage.originEncounterId,
    updatedAt: room.updatedAt,
  };
}
