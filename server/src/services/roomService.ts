import { randomUUID } from 'node:crypto';
import type { EncounterAction } from '../../../shared/src/contracts.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { ParticipantFocusState, RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import type {
  RoomEncounterLineage,
  RoomSystemEventQueueItem,
} from '../domain/rooms/RoomSystemEvent.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import type { RoomInvitation } from '../domain/rooms/RoomInvitation.js';
import type { PlayerPresence } from '../domain/rooms/PlayerPresence.js';
import type { SlotState } from '../domain/rooms/RoomSlot.js';
import { DEFAULT_SLOT_STATES } from '../domain/rooms/RoomSlot.js';
import {
  HELP_SEEN_WINDOW_MS,
  INACTIVITY_MS,
  MAX_PARTICIPANTS,
  RANDOM_HELP_RECIPIENT_COUNT,
  ROOM_INVITE_TTL_MS,
} from '../domain/rooms/roomConstants.js';
import {
  withDocumentTransaction,
  listPlayerIdsWithLiveSessions,
  type DocumentTransaction,
} from '../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../types/player.js';
import type { EncounterData } from '../engine/types.js';
import type { PlayerEncounterAction } from '../types/encounterSnapshot.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import type { AvatarDocument } from '../types/avatar.js';
import {
  buildEncounterSnapshot,
  buildLineagePreparedEncounter,
  ENCOUNTER_ACTION_ENABLE_DELAY_MS,
  prepareNextEncounter,
  preparedSystemEncounter,
  commitPreparedOutcome,
  prepareParticipantOutcome,
  preparedResultFromResolve,
  resolveNextEncounterForRoom,
  resolveParticipantInRoom,
  selectNextEncounter,
  withPrecomputedSnapshotRewards,
  type ResolveParticipantInRoomResult,
} from './encounterGenerator.js';
import {
  loadActiveEncounter,
  loadAvatar,
  saveActiveEncounter,
} from './encounterPersistence.js';
import { getEncounterById, getEncounters } from './gameData.js';
import {
  addPlayerYellowRedGems,
  getPlayerUnlockedExpansions,
  loadPlayer,
  loadPlayerActiveAvatar,
  loadPlayerAvatars,
} from './playerService.js';
import {
  findActiveRoomIdForPlayer,
  findActiveRoomIdForPlayerAvatar,
  loadEncounterRoom,
  loadPendingInvitations,
  loadPlayerPresence,
  normalizeEncounterRoom,
  saveEncounterRoom,
  savePlayerPresence,
  saveRoomInvitation,
} from './roomPersistence.js';
import {
  recordHelpJoinedEvent,
  recordHelpRequestedEvent,
  recordPlayerDisengagedEvent,
  recordPlayerJoinedRoomEvent,
  recordRoomCreatedEvent,
  recordRoomEncounterResolvedEvent,
  recordRoomEncounterStartedEvent,
} from './roomGameEvents.js';
import {
  ensureRoomLoreGemOffer,
  withEncounterLoreGemOffer,
} from './loreGemService.js';

export class RoomError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

function nowMs(): number {
  return Date.now();
}

async function loadEncounterRoomFromTransaction(
  transaction: DocumentTransaction,
  roomId: string,
): Promise<EncounterRoom | null> {
  const room = await transaction.getEncounterRoom<EncounterRoom>(roomId);
  if (!room) {
    return null;
  }

  return normalizeEncounterRoom(room);
}

export function clientActionToPlayerAction(action: EncounterAction): PlayerEncounterAction {
  switch (action) {
    case 'A':
      return { type: 'primaryA' };
    case 'B':
      return { type: 'secondaryB' };
    case 'C':
      return { type: 'primaryC' };
    case 'D':
      return { type: 'secondaryD' };
    case 'dice':
      return { type: 'dice' };
    default:
      throw new RoomError('Invalid encounter action');
  }
}

function createParticipant(
  playerId: string,
  avatarId: string,
  slotIndex: number,
): RoomParticipant {
  const now = nowMs();
  return {
    playerId,
    avatarId,
    slotIndex,
    joinedAt: now,
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    lastInteractionAt: now,
  };
}

function activeParticipants(room: EncounterRoom): RoomParticipant[] {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
}

function engagedParticipants(room: EncounterRoom): RoomParticipant[] {
  return room.participants.filter(
    (participant) =>
      participant.choiceState !== 'disengaged' &&
      participant.disconnectedAt === undefined,
  );
}

function participantsAwaitingContinue(room: EncounterRoom): RoomParticipant[] {
  return engagedParticipants(room).filter(
    (participant) =>
      participant.choiceState === 'ready_to_continue' ||
      participant.choiceState === 'resolved' ||
      participant.preparedResult !== undefined,
  );
}

function participantOutcomeSummary(
  participant: RoomParticipant,
): NonNullable<RoomParticipant['resolutionSummary']> | undefined {
  return participant.preparedResult ?? participant.resolutionSummary;
}

function canEnterWaitingContinue(room: EncounterRoom): boolean {
  const active = activeParticipants(room);
  if (active.length === 0) {
    return false;
  }

  if (!active.every((participant) => participant.choiceState === 'ready_to_continue')) {
    return false;
  }

  return active.some((participant) => participant.preparedResult !== undefined);
}

function canAdvanceRoom(room: EncounterRoom): boolean {
  const continueTargets = continueTargetsForRoom(room);
  if (continueTargets.some((participant) => participant.focusState !== 'none')) {
    return false;
  }

  return continueTargets.every((participant) => participant.continuePressed);
}

function isPostSystemEventContinue(room: EncounterRoom): boolean {
  return room.systemEvent?.lastEvent !== undefined;
}

function continueTargetsForRoom(room: EncounterRoom): RoomParticipant[] {
  if (isPostSystemEventContinue(room)) {
    return engagedParticipants(room);
  }

  const awaitingContinue = engagedParticipants(room).filter(
    (participant) =>
      participant.choiceState === 'ready_to_continue' ||
      participant.choiceState === 'resolved',
  );
  return awaitingContinue.length > 0 ? awaitingContinue : engagedParticipants(room);
}

function buildPendingSystemEventQueue(
  participants: RoomParticipant[],
): RoomSystemEventQueueItem[] {
  const sorted = [...participants].sort((a, b) => a.slotIndex - b.slotIndex);
  const queue: RoomSystemEventQueueItem[] = [];

  for (const participant of sorted) {
    const summary = participantOutcomeSummary(participant);
    if (!summary) {
      continue;
    }

    const leveledUp = summary.leveledUp === true;
    const deathTriggered = summary.deathTriggered === true;

    if (deathTriggered && leveledUp) {
      queue.push({
        actorPlayerId: participant.playerId,
        encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
        chainedLevelUp: true,
      });
    } else if (deathTriggered) {
      queue.push({
        actorPlayerId: participant.playerId,
        encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      });
    } else if (leveledUp) {
      queue.push({
        actorPlayerId: participant.playerId,
        encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      });
    }
  }

  return queue;
}

function buildLineageFromResolve(
  originSnapshot: EncounterSnapshot,
  result: ResolveParticipantInRoomResult,
): RoomEncounterLineage {
  return {
    originEncounterId: originSnapshot.encounterId,
    originEncounterFollow: originSnapshot.encounterFollow,
    originRollOutcome: result.selectedRollOutcome,
    originSuccess: result.resolution.success,
    preparedEncounter: buildLineagePreparedEncounter(
      result.deathTriggered,
      result.eventContext.leveledUp,
    ),
  };
}

function systemEventKindForEncounterId(encounterId: number): 'level_up' | 'atranor' {
  return encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID ? 'level_up' : 'atranor';
}

function isSoloContinueRoom(room: EncounterRoom): boolean {
  return participantsAwaitingContinue(room).length === 1;
}

/** True when no other players are in the party — solo players are never inactivity-disengaged. */
function isSoloPartyRoom(room: EncounterRoom): boolean {
  return room.participants.length === 1;
}

async function reengageParticipantIfNeeded(
  room: EncounterRoom,
  playerId: string,
): Promise<EncounterRoom> {
  const participant = findParticipant(room, playerId);
  if (!participant || participant.choiceState !== 'disengaged') {
    return room;
  }

  const now = nowMs();
  const wasWitnessToSystemEvent =
    room.systemEvent?.lastEvent !== undefined &&
    room.systemEvent.lastEvent.actorPlayerId !== participant.playerId;
  const restoredChoiceState =
    room.roomState === 'waiting_continue' &&
    (participant.preparedResult !== undefined ||
      participant.resolutionSummary !== undefined ||
      wasWitnessToSystemEvent)
      ? (participant.preparedResult !== undefined
        ? ('ready_to_continue' as const)
        : ('resolved' as const))
      : ('choosing' as const);

  const updated: EncounterRoom = {
    ...room,
    participants: room.participants.map((entry) =>
      entry.playerId === playerId
        ? {
            ...entry,
            choiceState: restoredChoiceState,
            disconnectedAt: undefined,
            focusState: 'none',
            lastInteractionAt: now,
          }
        : entry,
    ),
    updatedAt: now,
  };
  await saveEncounterRoom(updated);
  return updated;
}

async function reengageSoloParticipantIfNeeded(
  room: EncounterRoom,
  playerId: string,
): Promise<EncounterRoom> {
  if (!isSoloPartyRoom(room)) {
    return room;
  }

  return reengageParticipantIfNeeded(room, playerId);
}

async function maybeAutoAdvanceSoloRoom(
  room: EncounterRoom,
  playerId: string,
): Promise<EncounterRoom> {
  if (isPostSystemEventContinue(room)) {
    return room;
  }

  if (room.roomState !== 'waiting_continue' || !isSoloContinueRoom(room)) {
    return room;
  }

  const soloParticipant = participantsAwaitingContinue(room)[0];
  if (!soloParticipant || soloParticipant.playerId !== playerId) {
    return room;
  }

  return submitContinue(playerId, soloParticipant.avatarId);
}

async function mergeExpansionsForPlayerIds(playerIds: string[]): Promise<number[]> {
  const merged = new Set<number>();

  for (const playerId of playerIds) {
    const expansions = await getPlayerUnlockedExpansions(playerId);
    for (const expansionId of expansions) {
      merged.add(expansionId);
    }
  }

  if (merged.size === 0) {
    merged.add(0);
  }

  return [...merged].sort((a, b) => a - b);
}

function previousEncounterFromRoom(room: EncounterRoom): EncounterData | null {
  const lastId = room.lastEncounterId;
  if (typeof lastId !== 'number' || lastId <= 0) {
    return null;
  }
  return getEncounterById(lastId) ?? null;
}

async function seedRoomEncounterSnapshot(
  playerId: string,
  avatarId: string,
  roomId: string,
  mergedExpansions: number[],
  room?: EncounterRoom,
): Promise<EncounterSnapshot> {
  const existing = await loadActiveEncounter(playerId, avatarId);
  if (existing && !existing.resolved && existing.state === 'active') {
    return withEncounterLoreGemOffer({
      ...withPrecomputedSnapshotRewards(existing, await loadAvatar(playerId, avatarId) ?? undefined),
      roomId,
      state: 'active',
    });
  }

  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar) {
    throw new RoomError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
  }

  const encounter = selectNextEncounter({
    unlockedExpansions: mergedExpansions,
    previousEncounter: room ? previousEncounterFromRoom(room) : previousEncounterFromAvatar(avatar),
  });
  const preparedEncounter = prepareNextEncounter(encounter, mergedExpansions);
  const snapshot = buildEncounterSnapshot(
    playerId,
    avatarId,
    encounter,
    preparedEncounter,
    avatar,
  );

  return withEncounterLoreGemOffer({
    ...snapshot,
    roomId,
    state: 'active',
  });
}

function previousEncounterFromAvatar(avatar: AvatarDocument): EncounterData | null {
  const lastId = avatar.progression?.lastEncounterId;
  if (typeof lastId !== 'number' || lastId <= 0) {
    return null;
  }
  return getEncounterById(lastId) ?? null;
}

function resetParticipantsForNewEncounter(participants: RoomParticipant[]): RoomParticipant[] {
  const now = nowMs();
  return participants.map((participant) => ({
    ...participant,
    choiceState: participant.choiceState === 'disengaged' ? 'disengaged' as const : 'choosing' as const,
    focusState: 'none' as const,
    continuePressed: false,
    selectedAction: undefined,
    selectedSolutionId: undefined,
    resolutionSummary: undefined,
    preparedResult: undefined,
    preparedCommit: undefined,
    loreGemCollected: undefined,
    lastInteractionAt: now,
  }));
}

function getRoomNextEncounter(
  currentSnapshot: EncounterSnapshot,
  room: EncounterRoom,
): EncounterData {
  const summaries = activeParticipants(room)
    .map((participant) => participantOutcomeSummary(participant))
    .filter((summary): summary is NonNullable<typeof summary> => summary !== undefined);
  const allSucceeded = summaries.length > 0 && summaries.every((summary) => summary.success);

  if (allSucceeded && currentSnapshot.encounterFollow > 0) {
    const followUp = getEncounterById(currentSnapshot.encounterFollow);
    if (followUp) {
      return followUp;
    }
  }

  return selectNextEncounter({
    unlockedExpansions: room.mergedExpansions,
    previousEncounter: null,
  }, getEncounters());
}

async function setPresenceInRoom(playerId: string, roomId: string): Promise<void> {
  await savePlayerPresence({
    playerId,
    lastSeenAt: nowMs(),
    activeRoomId: roomId,
    state: 'in_room',
  });
}

async function clearPresenceRoom(playerId: string): Promise<void> {
  const existing = await loadPlayerPresence(playerId);
  await savePlayerPresence({
    playerId,
    lastSeenAt: nowMs(),
    activeRoomId: undefined,
    state: existing?.state === 'offline' ? 'offline' : 'online',
  });
}

export async function touchPlayerPresence(
  playerId: string,
  state: PlayerPresence['state'] = 'online',
): Promise<void> {
  const existing = await loadPlayerPresence(playerId);
  await savePlayerPresence({
    playerId,
    lastSeenAt: nowMs(),
    activeRoomId: existing?.activeRoomId,
    state: existing?.activeRoomId ? 'in_room' : state,
  });
}

function findParticipant(room: EncounterRoom, playerId: string): RoomParticipant | undefined {
  return room.participants.find((participant) => participant.playerId === playerId);
}

function findOpenSlot(room: EncounterRoom): number | null {
  const usedSlots = new Set(room.participants.map((participant) => participant.slotIndex));
  for (let slotIndex = 1; slotIndex < MAX_PARTICIPANTS; slotIndex += 1) {
    if (!usedSlots.has(slotIndex) && room.slotStates[slotIndex] !== 'locked') {
      return slotIndex;
    }
  }
  return null;
}

function isEncounterActionReady(snapshot: EncounterSnapshot): boolean {
  const readyAt = snapshot.actionReadyAt
    ?? (snapshot.createdAt + ENCOUNTER_ACTION_ENABLE_DELAY_MS);
  return nowMs() >= readyAt;
}

async function findCurrentAvatarRoomId(playerId: string): Promise<string | null> {
  const activeAvatar = await loadPlayerActiveAvatar(playerId);
  const activeAvatarId = activeAvatar?.id;
  if (activeAvatarId) {
    const avatarScopedRoomId = await findActiveRoomIdForPlayerAvatar(playerId, activeAvatarId);
    if (avatarScopedRoomId) {
      return avatarScopedRoomId;
    }
  }

  return findActiveRoomIdForPlayer(playerId);
}

export async function tickInactivity(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.roomState !== 'active_encounter') {
    return room;
  }

  if (isSoloPartyRoom(room)) {
    return room;
  }

  const now = nowMs();
  let changed = false;
  const nextParticipants = room.participants.map((participant) => {
    if (
      participant.choiceState === 'disengaged' ||
      participant.focusState !== 'none' ||
      participant.choiceState !== 'choosing'
    ) {
      return participant;
    }

    if (now - participant.lastInteractionAt >= INACTIVITY_MS) {
      changed = true;
      return {
        ...participant,
        choiceState: 'disengaged' as const,
        disconnectedAt: now,
      };
    }

    return participant;
  });

  if (!changed) {
    return room;
  }

  const updated: EncounterRoom = {
    ...room,
    participants: nextParticipants,
    updatedAt: now,
  };
  await saveEncounterRoom(updated);

  for (const participant of nextParticipants) {
    if (participant.choiceState === 'disengaged' && participant.disconnectedAt === now) {
      await recordPlayerDisengagedEvent(
        participant.playerId,
        participant.avatarId,
        room.roomId,
      );
    }
  }

  return updated;
}

async function beginSystemEventInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  queue: RoomSystemEventQueueItem[],
  lineage: RoomEncounterLineage,
  queueIndex: number,
): Promise<EncounterRoom> {
  const item = queue[queueIndex];
  if (!item) {
    throw new RoomError('System event queue is empty', 500, 'SYSTEM_EVENT_QUEUE_EMPTY');
  }

  const actor = findParticipant(room, item.actorPlayerId);
  if (!actor) {
    throw new RoomError('System event actor not found', 404, 'SYSTEM_EVENT_ACTOR_NOT_FOUND');
  }

  const systemEncounter = getEncounterById(item.encounterId);
  if (!systemEncounter) {
    throw new RoomError('System encounter not found', 500, 'SYSTEM_ENCOUNTER_NOT_FOUND');
  }

  const actorAvatar = await transaction.getAvatar<AvatarDocument>(
    actor.playerId,
    actor.avatarId,
  );
  const prepared = preparedSystemEncounter(item.encounterId);
  const snapshot = withEncounterLoreGemOffer({
    ...buildEncounterSnapshot(
      actor.playerId,
      actor.avatarId,
      systemEncounter,
      prepared,
      actorAvatar ?? undefined,
    ),
    roomId: room.roomId,
    state: 'active',
  });

  const participants = room.participants.map((participant) => {
    if (participant.choiceState === 'disengaged') {
      return participant;
    }

    if (participant.playerId === item.actorPlayerId) {
      return {
        ...participant,
        choiceState: 'choosing' as const,
        continuePressed: false,
        selectedAction: undefined,
        selectedSolutionId: undefined,
        focusState: 'none' as const,
      };
    }

    return {
      ...participant,
      choiceState: 'witnessing' as const,
      continuePressed: false,
      focusState: 'none' as const,
    };
  });

  const systemEventRoom: EncounterRoom = {
    ...room,
    roomState: 'system_event',
    activeEncounterSnapshot: snapshot,
    systemEvent: {
      queue,
      queueIndex,
      lineage,
    },
    participants,
    updatedAt: nowMs(),
  };

  await transaction.setEncounterRoom(room.roomId, systemEventRoom);

  for (const participant of participants) {
    if (participant.choiceState === 'disengaged') {
      continue;
    }
    await transaction.setActiveEncounter(
      participant.playerId,
      participant.avatarId,
      snapshot,
    );
  }

  return systemEventRoom;
}

function participantSummaryFromResolve(
  result: ResolveParticipantInRoomResult,
): NonNullable<RoomParticipant['resolutionSummary']> {
  return preparedResultFromResolve(result);
}

async function grantRoomLoreGemsOnCommit(room: EncounterRoom): Promise<void> {
  const snapshotId = room.activeEncounterSnapshot.snapshotId;
  if (
    room.loreGemActivated !== true ||
    room.loreGemActivatedSnapshotId !== snapshotId
  ) {
    return;
  }

  for (const participant of activeParticipants(room)) {
    if (participant.loreGemCollected !== true) {
      continue;
    }

    const claimKey = `${snapshotId}:${participant.playerId}`;
    const player = await loadPlayer(participant.playerId);
    if (player?.loreGemClaims?.[claimKey] === true) {
      continue;
    }
    await addPlayerYellowRedGems(participant.playerId, 1, claimKey);
  }
}

async function commitPreparedResultsForRoom(
  transaction: DocumentTransaction,
  room: EncounterRoom,
): Promise<{
  participants: RoomParticipant[];
  commits: Map<string, ResolveParticipantInRoomResult>;
}> {
  let nextParticipants = [...room.participants];
  const commits = new Map<string, ResolveParticipantInRoomResult>();

  for (const participant of nextParticipants) {
    if (participant.choiceState === 'disengaged') {
      continue;
    }

    if (participant.preparedCommit && participant.selectedAction) {
      const result = await commitPreparedOutcome(
        transaction,
        participant.playerId,
        participant.avatarId,
        participant.preparedCommit,
      );
      commits.set(participant.playerId, result);

      nextParticipants = nextParticipants.map((entry) =>
        entry.playerId === participant.playerId
          ? {
              ...entry,
              choiceState: result.avatarDied ? 'disengaged' as const : entry.choiceState,
              resolutionSummary: participantSummaryFromResolve(result),
              preparedResult: undefined,
              preparedCommit: undefined,
              ...(result.avatarDied ? { disconnectedAt: nowMs() } : {}),
            }
          : entry,
      );
    }
  }

  return { participants: nextParticipants, commits };
}

async function advanceRoomAfterCommit(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  committedParticipants: RoomParticipant[],
  commits: Map<string, ResolveParticipantInRoomResult>,
): Promise<EncounterRoom> {
  const roomId = room.roomId;
  const participants = engagedParticipants({ ...room, participants: committedParticipants });
  if (participants.length === 0) {
    const closed: EncounterRoom = {
      ...room,
      participants: committedParticipants,
      roomState: 'closed',
      updatedAt: nowMs(),
    };
    await transaction.setEncounterRoom(roomId, closed);
    return closed;
  }

  const pendingQueue = buildPendingSystemEventQueue(committedParticipants);
  if (pendingQueue.length > 0) {
    const firstItem = pendingQueue[0]!;
    const actorResult = commits.get(firstItem.actorPlayerId);
    if (!actorResult) {
      throw new RoomError('System event actor resolve missing', 500, 'SYSTEM_EVENT_ACTOR_MISSING');
    }

    const lineage = buildLineageFromResolve(room.activeEncounterSnapshot, actorResult);
    const resolvedParticipantsRoom: EncounterRoom = {
      ...room,
      participants: committedParticipants,
      updatedAt: nowMs(),
    };

    return beginSystemEventInTransaction(
      transaction,
      resolvedParticipantsRoom,
      pendingQueue,
      lineage,
      0,
    );
  }

  const leader = findParticipant({ ...room, participants: committedParticipants }, room.leaderPlayerId)
    ?? participants[0];
  const lineage = room.systemEvent?.lineage;
  const lastEncounterId = lineage?.originEncounterId ?? room.activeEncounterSnapshot.encounterId;

  let nextEncounter: EncounterData;
  let preparedEncounter: ReturnType<typeof prepareNextEncounter>;
  if (lineage) {
    const resolved = resolveNextEncounterForRoom(lineage, room.mergedExpansions);
    nextEncounter = resolved.encounter;
    preparedEncounter = resolved.prepared;
  } else {
    nextEncounter = getRoomNextEncounter(room.activeEncounterSnapshot, {
      ...room,
      participants: committedParticipants,
    });
    preparedEncounter = prepareNextEncounter(nextEncounter, room.mergedExpansions);
  }

  const nextSnapshot = withEncounterLoreGemOffer({
    ...buildEncounterSnapshot(
      leader.playerId,
      leader.avatarId,
      nextEncounter,
      preparedEncounter,
      await transaction.getAvatar<AvatarDocument>(leader.playerId, leader.avatarId) ?? undefined,
    ),
    roomId: room.roomId,
    state: 'active',
  }, nowMs());

  const advanced: EncounterRoom = {
    ...room,
    activeEncounterSnapshot: nextSnapshot,
    lastEncounterId,
    helpCalledSnapshotId: undefined,
    systemEvent: undefined,
    loreGemActivated: undefined,
    loreGemActivatedSnapshotId: undefined,
    advanceStartedAt: undefined,
    participants: resetParticipantsForNewEncounter(committedParticipants),
    roomState: 'active_encounter',
    updatedAt: nowMs(),
  };

  await transaction.setEncounterRoom(roomId, advanced);

  for (const participant of advanced.participants) {
    await transaction.setActiveEncounter(
      participant.playerId,
      participant.avatarId,
      nextSnapshot,
    );
  }

  return advanced;
}

export async function tickRoom(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.roomState === 'waiting_continue' && !canAdvanceRoom(room)) {
    return room;
  }

  if (room.roomState !== 'waiting_continue' && room.roomState !== 'advancing') {
    return room;
  }

  const roomId = room.roomId;
  const advanced = await withDocumentTransaction(async (transaction) => {
    const current = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!current || current.roomState !== 'waiting_continue' || !canAdvanceRoom(current)) {
      return current;
    }

    const now = nowMs();
    const advancingRoom: EncounterRoom = {
      ...current,
      roomState: 'advancing',
      advanceStartedAt: current.advanceStartedAt ?? now,
      updatedAt: now,
    };
    await transaction.setEncounterRoom(roomId, advancingRoom);

    const { participants: committedParticipants, commits } =
      await commitPreparedResultsForRoom(transaction, advancingRoom);
    const committedRoom: EncounterRoom = {
      ...advancingRoom,
      participants: committedParticipants,
    };

    await grantRoomLoreGemsOnCommit(committedRoom);

    return advanceRoomAfterCommit(transaction, committedRoom, committedParticipants, commits);
  });

  if (advanced && advanced !== room) {
    if (advanced.roomState === 'active_encounter') {
      await recordRoomEncounterStartedEvent(advanced);
    }
  }

  return advanced ?? room;
}

async function tickRoomById(roomId: string): Promise<EncounterRoom | null> {
  const room = await loadEncounterRoom(roomId);
  if (!room) {
    return null;
  }
  return tickRoom(room);
}

async function tryResolveSystemEventIfReady(roomId: string): Promise<EncounterRoom | null> {
  return withDocumentTransaction(async (transaction) => {
    const room = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!room || room.roomState !== 'system_event' || !room.systemEvent) {
      return room;
    }

    const { queue, queueIndex, lineage } = room.systemEvent;
    const item = queue[queueIndex];
    if (!item) {
      return room;
    }

    const actor = findParticipant(room, item.actorPlayerId);
    if (
      !actor ||
      !actor.selectedAction ||
      (actor.choiceState !== 'ready_to_continue' && actor.choiceState !== 'ready')
    ) {
      return room;
    }

    const result = actor.preparedCommit
      ? await commitPreparedOutcome(
        transaction,
        actor.playerId,
        actor.avatarId,
        actor.preparedCommit,
      )
      : await resolveParticipantInRoom(
        transaction,
        actor.playerId,
        actor.avatarId,
        room.activeEncounterSnapshot,
        actor.selectedAction,
      );

    const actorSummary = participantSummaryFromResolve(result);
    const now = nowMs();
    let nextParticipants = room.participants.map((entry) =>
      entry.playerId === actor.playerId
        ? {
            ...entry,
            choiceState: 'resolved' as const,
            resolutionSummary: actorSummary,
            ...(result.avatarDied
              ? { choiceState: 'disengaged' as const, disconnectedAt: now }
              : {}),
          }
        : entry,
    );

    let workingRoom: EncounterRoom = {
      ...room,
      participants: nextParticipants,
      updatedAt: now,
    };

    if (
      item.chainedLevelUp &&
      room.activeEncounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID
    ) {
      const nextQueue: RoomSystemEventQueueItem[] = [
        {
          actorPlayerId: item.actorPlayerId,
          encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        },
        ...queue.slice(queueIndex + 1),
      ];
      return beginSystemEventInTransaction(
        transaction,
        workingRoom,
        nextQueue,
        lineage,
        0,
      );
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      return beginSystemEventInTransaction(
        transaction,
        workingRoom,
        queue,
        lineage,
        nextIndex,
      );
    }

    const kind = systemEventKindForEncounterId(room.activeEncounterSnapshot.encounterId);
    if (!actorSummary) {
      throw new RoomError('System event actor summary missing', 500, 'SYSTEM_EVENT_SUMMARY_MISSING');
    }

    const completedParticipants = workingRoom.participants.map((participant) => {
      if (participant.choiceState === 'disengaged') {
        return participant;
      }

      return {
        ...participant,
        choiceState: 'resolved' as const,
        continuePressed: false,
        focusState: 'none' as const,
      };
    });

    const completedRoom: EncounterRoom = {
      ...workingRoom,
      participants: completedParticipants,
      roomState: 'waiting_continue',
      systemEvent: {
        queue: [],
        queueIndex: 0,
        lineage,
        lastEvent: {
          kind,
          actorPlayerId: item.actorPlayerId,
          resolutionSummary: actorSummary,
        },
      },
      updatedAt: now,
    };

    await transaction.setEncounterRoom(roomId, completedRoom);
    return completedRoom;
  });
}

async function applyParticipantPrepare(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  playerId: string,
  playerAction: PlayerEncounterAction,
  solutionId: number | undefined,
  now: number,
): Promise<EncounterRoom> {
  const participant = findParticipant(room, playerId);
  if (!participant || participant.choiceState === 'disengaged') {
    throw new RoomError('Not an active participant', 403, 'NOT_PARTICIPANT');
  }

  const prepared = await prepareParticipantOutcome(
    transaction,
    playerId,
    participant.avatarId,
    room.activeEncounterSnapshot,
    playerAction,
  );

  let nextParticipants = room.participants.map((entry) =>
    entry.playerId === playerId
      ? {
          ...entry,
          choiceState: 'ready_to_continue' as const,
          selectedAction: playerAction,
          selectedSolutionId: solutionId,
          preparedResult: prepared.preparedResult,
          preparedCommit: prepared.preparedCommit,
          resolutionSummary: undefined,
          lastInteractionAt: now,
        }
      : entry,
  );

  const workingRoom: EncounterRoom = {
    ...room,
    participants: nextParticipants,
    roomState: canEnterWaitingContinue({ ...room, participants: nextParticipants })
      ? 'waiting_continue'
      : room.roomState,
    updatedAt: now,
  };

  await transaction.setEncounterRoom(room.roomId, workingRoom);
  return workingRoom;
}

export async function createRoom(
  playerId: string,
  avatarId: string,
): Promise<EncounterRoom> {
  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar) {
    throw new RoomError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
  }

  const existingRoomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (existingRoomId) {
    const existing = await loadEncounterRoom(existingRoomId);
    if (existing && existing.roomState !== 'closed') {
      return tickInactivity(existing);
    }
  }

  const mergedExpansions = await mergeExpansionsForPlayerIds([playerId]);
  const roomId = randomUUID();
  const snapshot = await seedRoomEncounterSnapshot(playerId, avatarId, roomId, mergedExpansions);

  const room: EncounterRoom = {
    roomId,
    leaderPlayerId: playerId,
    participants: [createParticipant(playerId, avatarId, 0)],
    slotStates: DEFAULT_SLOT_STATES,
    mergedExpansions,
    activeEncounterSnapshot: snapshot,
    roomState: 'active_encounter',
    lastEncounterId: avatar.progression?.lastEncounterId,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };

  await saveEncounterRoom(room);
  await saveActiveEncounter({
    ...snapshot,
    playerId,
    avatarId,
  });
  await setPresenceInRoom(playerId, roomId);
  await recordRoomCreatedEvent(playerId, room);
  await recordRoomEncounterStartedEvent(room);
  return room;
}

export async function getActiveRoomForPlayer(
  playerId: string,
  avatarId?: string,
): Promise<EncounterRoom | null> {
  const roomId = avatarId
    ? await findActiveRoomIdForPlayerAvatar(playerId, avatarId)
    : await findCurrentAvatarRoomId(playerId);
  if (!roomId) {
    return null;
  }

  let room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    return null;
  }

  room = await reengageSoloParticipantIfNeeded(room, playerId);
  room = await ensureRoomLoreGemOffer(room);
  room = await tickRoom(room);
  return tickInactivity(room);
}

export async function joinRoom(
  playerId: string,
  avatarId: string,
  roomId: string,
): Promise<EncounterRoom> {
  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar) {
    throw new RoomError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
  }

  const existingRoomId = await findActiveRoomIdForPlayer(playerId);
  if (existingRoomId && existingRoomId !== roomId) {
    throw new RoomError('Already in another room', 409, 'ALREADY_IN_ROOM');
  }

  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.participants.some((participant) => participant.playerId === playerId)) {
    return tickInactivity(room);
  }

  const slotIndex = findOpenSlot(room);
  if (slotIndex === null) {
    throw new RoomError('Room is full', 409, 'ROOM_FULL');
  }

  const slotState = room.slotStates[slotIndex];
  if (slotState === 'locked') {
    throw new RoomError('Slot is locked', 403, 'SLOT_LOCKED');
  }

  if (slotState === 'friends_only') {
    const leader = await loadPlayer(room.leaderPlayerId);
    const friendIds = leader?.friendIds ?? [];
    if (!friendIds.includes(playerId)) {
      throw new RoomError('Friends only slot', 403, 'FRIENDS_ONLY');
    }
  }

  const mergedExpansions = await mergeExpansionsForPlayerIds(
    [...room.participants.map((p) => p.playerId), playerId],
  );

  const updated: EncounterRoom = {
    ...room,
    participants: [...room.participants, createParticipant(playerId, avatarId, slotIndex)],
    mergedExpansions,
    updatedAt: nowMs(),
  };

  await saveEncounterRoom(updated);
  await saveActiveEncounter({
    ...updated.activeEncounterSnapshot,
    playerId,
    avatarId,
  });
  await setPresenceInRoom(playerId, roomId);
  await recordPlayerJoinedRoomEvent(playerId, avatarId, updated);
  return updated;
}

export async function leaveRoom(playerId: string, avatarId?: string): Promise<void> {
  const roomId = avatarId
    ? await findActiveRoomIdForPlayerAvatar(playerId, avatarId)
    : await findCurrentAvatarRoomId(playerId);
  if (!roomId) {
    return;
  }

  const room = await loadEncounterRoom(roomId);
  if (!room) {
    await clearPresenceRoom(playerId);
    return;
  }

  const remaining = room.participants.filter((participant) => participant.playerId !== playerId);
  if (remaining.length === 0 || playerId === room.leaderPlayerId) {
    const closed: EncounterRoom = {
      ...room,
      roomState: 'closed',
      updatedAt: nowMs(),
    };
    await saveEncounterRoom(closed);
    for (const participant of room.participants) {
      await clearPresenceRoom(participant.playerId);
    }
    return;
  }

  const updated: EncounterRoom = {
    ...room,
    participants: remaining,
    mergedExpansions: await mergeExpansionsForPlayerIds(remaining.map((p) => p.playerId)),
    updatedAt: nowMs(),
  };
  await saveEncounterRoom(updated);
  await clearPresenceRoom(playerId);
}

export async function setSlotState(
  playerId: string,
  avatarId: string,
  slotIndex: number,
  slotState: SlotState,
): Promise<EncounterRoom> {
  const room = await getActiveRoomForPlayer(playerId, avatarId);
  if (!room) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  if (room.leaderPlayerId !== playerId) {
    throw new RoomError('Only the leader can change slots', 403, 'NOT_LEADER');
  }

  if (slotIndex < 1 || slotIndex >= MAX_PARTICIPANTS) {
    throw new RoomError('Invalid slot index');
  }

  const nextSlotStates = [...room.slotStates] as [SlotState, SlotState, SlotState];
  nextSlotStates[slotIndex] = slotState;

  const updated: EncounterRoom = {
    ...room,
    slotStates: nextSlotStates,
    updatedAt: nowMs(),
  };
  await saveEncounterRoom(updated);
  return updated;
}

export async function submitChoice(
  playerId: string,
  avatarId: string,
  action: EncounterAction,
  solutionId?: number,
): Promise<EncounterRoom> {
  const roomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (!roomId) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  const playerAction = clientActionToPlayerAction(action);
  const now = nowMs();

  const loadedRoom = await loadEncounterRoom(roomId);
  if (loadedRoom) {
    await reengageParticipantIfNeeded(loadedRoom, playerId);
  }

  const updated = await withDocumentTransaction(async (transaction) => {
    const room = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!room) {
      throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.roomState === 'system_event') {
      const systemEvent = room.systemEvent;
      const currentItem = systemEvent?.queue[systemEvent.queueIndex];
      if (!currentItem || currentItem.actorPlayerId !== playerId) {
        throw new RoomError('Witnesses cannot submit choices', 403, 'WITNESS_READONLY');
      }

      const participant = findParticipant(room, playerId);
      if (!participant || participant.choiceState === 'disengaged') {
        throw new RoomError('Not an active participant', 403, 'NOT_PARTICIPANT');
      }
      if (!isEncounterActionReady(room.activeEncounterSnapshot)) {
        throw new RoomError('Action is not ready yet', 409, 'ACTION_NOT_READY');
      }

      return applyParticipantPrepare(
        transaction,
        room,
        playerId,
        playerAction,
        solutionId,
        now,
      );
    }

    if (room.roomState !== 'active_encounter') {
      throw new RoomError('Room is not accepting choices', 409, 'INVALID_ROOM_STATE');
    }

    if (!isEncounterActionReady(room.activeEncounterSnapshot)) {
      throw new RoomError('Action is not ready yet', 409, 'ACTION_NOT_READY');
    }

    return applyParticipantPrepare(
      transaction,
      room,
      playerId,
      playerAction,
      solutionId,
      now,
    );
  });

  if (updated.roomState === 'system_event') {
    const resolved = await tryResolveSystemEventIfReady(roomId);
    return resolved ?? updated;
  }

  if (updated.roomState === 'waiting_continue') {
    await recordRoomEncounterResolvedEvent(updated);
  }

  const ticked = await tickRoomById(roomId);
  const result = ticked ?? updated;
  return maybeAutoAdvanceSoloRoom(result, playerId);
}

export async function setFocusState(
  playerId: string,
  avatarId: string,
  focusState: ParticipantFocusState,
): Promise<EncounterRoom> {
  const roomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (!roomId) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  const now = nowMs();
  let room = await loadEncounterRoom(roomId);
  if (!room) {
    throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (focusState !== 'none') {
    room = await reengageParticipantIfNeeded(room, playerId);
  }

  const updated: EncounterRoom = {
    ...room,
    participants: room.participants.map((participant) =>
      participant.playerId === playerId
        ? {
            ...participant,
            focusState,
            lastInteractionAt: focusState === 'none' ? participant.lastInteractionAt : now,
          }
        : participant,
    ),
    updatedAt: now,
  };
  await saveEncounterRoom(updated);
  return updated;
}

export async function submitContinue(playerId: string, avatarId: string): Promise<EncounterRoom> {
  const roomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (!roomId) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  const now = nowMs();
  let room = await loadEncounterRoom(roomId);
  if (
    !room ||
    (room.roomState !== 'waiting_continue' && room.roomState !== 'advancing')
  ) {
    throw new RoomError('Room is not waiting to continue', 409, 'INVALID_ROOM_STATE');
  }

  room = await reengageParticipantIfNeeded(room, playerId);

  const continueTargets = continueTargetsForRoom(room);
  const localParticipant = findParticipant(room, playerId);
  if (
    localParticipant &&
    continueTargets.some((target) => target.playerId === playerId) &&
    localParticipant.choiceState !== 'ready_to_continue' &&
    localParticipant.choiceState !== 'resolved'
  ) {
    throw new RoomError('Outcome not ready to continue', 409, 'NOT_READY_TO_CONTINUE');
  }

  const withContinue: EncounterRoom = {
    ...room,
    participants: room.participants.map((participant) => {
      if (participant.playerId === playerId) {
        return {
          ...participant,
          continuePressed: true,
          focusState: 'none',
          lastInteractionAt: now,
        };
      }
      return participant;
    }),
    updatedAt: now,
  };
  await saveEncounterRoom(withContinue);

  if (isSoloPartyRoom(withContinue)) {
    return tickRoom(withContinue);
  }

  return withContinue;
}

function isFriendRecentlySeen(lastPlayedAt: number | undefined, now: number): boolean {
  if (typeof lastPlayedAt !== 'number') {
    return false;
  }
  return now - lastPlayedAt <= HELP_SEEN_WINDOW_MS;
}

function isPlayerOnlineAndActive(
  player: PlayerDocument,
  liveSessionPlayerIds: Set<string>,
  now: number,
): boolean {
  if (player.moderation?.banned === true) {
    return false;
  }

  const timeoutUntil = player.moderation?.timeoutUntil;
  if (typeof timeoutUntil === 'number' && timeoutUntil > now) {
    return false;
  }

  if (!liveSessionPlayerIds.has(player.playerId)) {
    return false;
  }

  return isFriendRecentlySeen(player.lastPlayedAt, now);
}

function shufflePlayerIds(playerIds: string[]): string[] {
  const shuffled = [...playerIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function canReceiveHelpInvite(
  fromPlayerId: string,
  toPlayerId: string,
  roomId: string,
): Promise<boolean> {
  if (toPlayerId === fromPlayerId) {
    return false;
  }

  const targetRoomId = await findActiveRoomIdForPlayer(toPlayerId);
  if (targetRoomId) {
    return false;
  }

  const pending = await loadPendingInvitations(toPlayerId);
  return !pending.some(
    (invite) => invite.fromPlayerId === fromPlayerId && invite.roomId === roomId,
  );
}

async function sendHelpInvitation(
  fromPlayerId: string,
  toPlayerId: string,
  room: EncounterRoom,
  fromPlayerName: string,
  avatarVisual?: { portrait?: string; frame?: string },
): Promise<RoomInvitation> {
  const invitation: RoomInvitation = {
    inviteId: randomUUID(),
    roomId: room.roomId,
    fromPlayerId,
    toPlayerId,
    createdAt: nowMs(),
    expiresAt: nowMs() + ROOM_INVITE_TTL_MS,
    status: 'pending',
  };

  await saveRoomInvitation(invitation);
  await recordHelpRequestedEvent(
    fromPlayerId,
    toPlayerId,
    room.roomId,
    invitation.inviteId,
    {
      encounterId: room.activeEncounterSnapshot.encounterId,
      encounterTitle: room.activeEncounterSnapshot.encounterTitle,
      fromPlayerName,
      avatarPortrait: avatarVisual?.portrait,
      avatarFrame: avatarVisual?.frame,
    },
  );
  return invitation;
}

export interface BroadcastCallForHelpResult {
  invitedCount: number;
  targetMode: 'friends' | 'random';
  helpCalled: boolean;
}

async function resolveHelpJoinAvatarId(
  playerId: string,
  avatarId?: string,
): Promise<string> {
  if (avatarId) {
    return avatarId;
  }

  const activeAvatar = await loadPlayerActiveAvatar(playerId);
  if (activeAvatar?.id) {
    return activeAvatar.id;
  }

  const avatars = await loadPlayerAvatars(playerId);
  if (avatars.length === 0) {
    throw new RoomError('No avatar available to join', 404, 'NO_AVATAR');
  }

  const lastPlayed = avatars.reduce((best, current) => {
    const currentLastPlayed = current.lastPlayedAt ?? current.createdAt ?? 0;
    const bestLastPlayed = best.lastPlayedAt ?? best.createdAt ?? 0;
    return currentLastPlayed >= bestLastPlayed ? current : best;
  });

  if (!lastPlayed.id) {
    throw new RoomError('No avatar available to join', 404, 'NO_AVATAR');
  }

  return lastPlayed.id;
}

export async function broadcastCallForHelp(
  fromPlayerId: string,
  avatarId?: string,
): Promise<BroadcastCallForHelpResult> {
  let room = await getActiveRoomForPlayer(fromPlayerId, avatarId);
  if (!room) {
    if (!avatarId) {
      throw new RoomError('No active room', 404, 'NO_ROOM');
    }
    room = await createRoom(fromPlayerId, avatarId);
  }

  const snapshotId = room.activeEncounterSnapshot.snapshotId;
  if (room.helpCalledSnapshotId === snapshotId) {
    throw new RoomError('Help already called for this encounter', 409, 'HELP_ALREADY_USED');
  }

  const now = nowMs();
  const liveSessionPlayerIds = await listPlayerIdsWithLiveSessions(now);
  const fromPlayer = await loadPlayer(fromPlayerId);
  const friendIds = fromPlayer?.friendIds ?? [];

  const callerAvatar = avatarId ? await loadAvatar(fromPlayerId, avatarId) : null;
  const avatarVisual = callerAvatar?.portrait && callerAvatar.frame
    ? { portrait: callerAvatar.portrait, frame: callerAvatar.frame }
    : undefined;
  const fromPlayerName = fromPlayer?.playerName?.trim() || fromPlayerId;

  const eligibleFriendIds: string[] = [];
  for (const friendId of friendIds) {
    const friendPlayer = await loadPlayer(friendId);
    if (!friendPlayer || !liveSessionPlayerIds.has(friendId)) {
      continue;
    }
    if (!(await canReceiveHelpInvite(fromPlayerId, friendId, room.roomId))) {
      continue;
    }
    eligibleFriendIds.push(friendId);
  }

  let targetIds = eligibleFriendIds;
  let targetMode: BroadcastCallForHelpResult['targetMode'] = 'friends';

  if (targetIds.length === 0) {
    targetMode = 'random';
    const randomCandidates: string[] = [];

    for (const candidateId of liveSessionPlayerIds) {
      if (candidateId === fromPlayerId || friendIds.includes(candidateId)) {
        continue;
      }

      const candidate = await loadPlayer(candidateId);
      if (!candidate || !isPlayerOnlineAndActive(candidate, liveSessionPlayerIds, now)) {
        continue;
      }

      if (!(await canReceiveHelpInvite(fromPlayerId, candidateId, room.roomId))) {
        continue;
      }

      randomCandidates.push(candidateId);
    }

    targetIds = shufflePlayerIds(randomCandidates).slice(0, RANDOM_HELP_RECIPIENT_COUNT);
  }

  for (const targetId of targetIds) {
    await sendHelpInvitation(
      fromPlayerId,
      targetId,
      room,
      fromPlayerName,
      avatarVisual,
    );
  }

  const updatedRoom: EncounterRoom = {
    ...room,
    helpCalledSnapshotId: snapshotId,
    updatedAt: now,
  };
  await saveEncounterRoom(updatedRoom);

  return {
    invitedCount: targetIds.length,
    targetMode,
    helpCalled: true,
  };
}

/** @deprecated Use broadcastCallForHelp for the in-game help button. */
export async function requestHelp(
  fromPlayerId: string,
  friendId: string,
): Promise<RoomInvitation> {
  const room = await getActiveRoomForPlayer(fromPlayerId);
  if (!room) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  const fromPlayer = await loadPlayer(fromPlayerId);
  const friendIds = fromPlayer?.friendIds ?? [];
  if (!friendIds.includes(friendId)) {
    throw new RoomError('Target is not a friend', 403, 'NOT_FRIEND');
  }

  const friendPlayer = await loadPlayer(friendId);
  if (!friendPlayer) {
    throw new RoomError('Friend not found', 404, 'FRIEND_NOT_FOUND');
  }

  if (!isFriendRecentlySeen(friendPlayer.lastPlayedAt, nowMs())) {
    throw new RoomError('Friend has not been seen recently', 403, 'FRIEND_NOT_RECENT');
  }

  const friendRoomId = await findActiveRoomIdForPlayer(friendId);
  if (friendRoomId) {
    throw new RoomError('Friend is already in a room', 409, 'FRIEND_IN_ROOM');
  }

  const pending = await loadPendingInvitations(friendId);
  if (pending.some((invite) => invite.fromPlayerId === fromPlayerId && invite.roomId === room.roomId)) {
    throw new RoomError('Invitation already pending', 409, 'INVITE_PENDING');
  }

  const invitation: RoomInvitation = {
    inviteId: randomUUID(),
    roomId: room.roomId,
    fromPlayerId,
    toPlayerId: friendId,
    createdAt: nowMs(),
    expiresAt: nowMs() + ROOM_INVITE_TTL_MS,
    status: 'pending',
  };

  const fromPlayerName = fromPlayer?.playerName?.trim() || fromPlayerId;
  await saveRoomInvitation(invitation);
  await recordHelpRequestedEvent(
    fromPlayerId,
    friendId,
    room.roomId,
    invitation.inviteId,
    {
      encounterId: room.activeEncounterSnapshot.encounterId,
      encounterTitle: room.activeEncounterSnapshot.encounterTitle,
      fromPlayerName,
    },
  );
  return invitation;
}

export interface FriendJoinableRoom {
  roomId: string;
  encounterTitle: string;
  participantCount: number;
  maxParticipants: number;
  inviteId?: string;
}

async function assertPlayersAreFriends(playerId: string, friendPlayerId: string): Promise<void> {
  const fromPlayer = await loadPlayer(playerId);
  const friendIds = fromPlayer?.friendIds ?? [];
  if (!friendIds.includes(friendPlayerId)) {
    throw new RoomError('Target is not a friend', 403, 'NOT_FRIEND');
  }
}

function canViewerJoinRoom(
  room: EncounterRoom,
  viewerPlayerId: string,
  leaderFriendIds: string[],
): boolean {
  if (room.roomState === 'closed') {
    return false;
  }

  if (engagedParticipants(room).length >= MAX_PARTICIPANTS) {
    return false;
  }

  const openSlot = findOpenSlot(room);
  if (openSlot === null) {
    return false;
  }

  const slotState = room.slotStates[openSlot];
  if (slotState === 'locked') {
    return false;
  }

  if (slotState === 'friends_only' && !leaderFriendIds.includes(viewerPlayerId)) {
    return false;
  }

  return true;
}

export async function describeJoinableRoomForFriend(
  viewerPlayerId: string,
  friendPlayerId: string,
): Promise<FriendJoinableRoom | null> {
  await assertPlayersAreFriends(viewerPlayerId, friendPlayerId);

  const now = nowMs();
  const pendingInvites = await loadPendingInvitations(viewerPlayerId);
  const helpInvite = pendingInvites.find(
    (invite) => invite.fromPlayerId === friendPlayerId && invite.expiresAt > now,
  );

  const roomId = helpInvite?.roomId ?? await findActiveRoomIdForPlayer(friendPlayerId);
  if (!roomId) {
    return null;
  }

  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    return null;
  }

  const friendPlayer = await loadPlayer(friendPlayerId);
  const leaderFriendIds = friendPlayer?.friendIds ?? [];
  if (!canViewerJoinRoom(room, viewerPlayerId, leaderFriendIds)) {
    if (!helpInvite) {
      return null;
    }
  }

  const participantCount = engagedParticipants(room).length;
  if (!helpInvite && participantCount !== 1) {
    return null;
  }

  if (participantCount >= MAX_PARTICIPANTS && !helpInvite) {
    return null;
  }

  return {
    roomId: room.roomId,
    encounterTitle: room.activeEncounterSnapshot.encounterTitle ?? 'Encounter',
    participantCount,
    maxParticipants: MAX_PARTICIPANTS,
    ...(helpInvite ? { inviteId: helpInvite.inviteId } : {}),
  };
}

export async function joinFriendRoom(
  playerId: string,
  friendPlayerId: string,
  avatarId?: string,
): Promise<EncounterRoom> {
  await assertPlayersAreFriends(playerId, friendPlayerId);

  const now = nowMs();
  const pendingInvites = await loadPendingInvitations(playerId);
  const helpInvite = pendingInvites.find(
    (invite) => invite.fromPlayerId === friendPlayerId && invite.expiresAt > now,
  );

  if (helpInvite) {
    const joined = await respondHelp(playerId, helpInvite.inviteId, true, avatarId);
    if (!joined) {
      throw new RoomError('Invitation was declined', 409, 'INVITE_DECLINED');
    }
    return joined;
  }

  const roomId = await findActiveRoomIdForPlayer(friendPlayerId);
  if (!roomId) {
    throw new RoomError('Friend is not in a room', 404, 'FRIEND_NOT_IN_ROOM');
  }

  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  const friendPlayer = await loadPlayer(friendPlayerId);
  const leaderFriendIds = friendPlayer?.friendIds ?? [];
  if (!canViewerJoinRoom(room, playerId, leaderFriendIds)) {
    throw new RoomError('You cannot join this room right now', 409, 'ROOM_NOT_JOINABLE');
  }

  const existingRoomId = await findActiveRoomIdForPlayer(playerId);
  if (existingRoomId && existingRoomId !== roomId) {
    await leaveRoom(playerId);
  }

  const joinAvatarId = await resolveHelpJoinAvatarId(playerId, avatarId);
  const joined = await joinRoom(playerId, joinAvatarId, roomId);
  await recordHelpJoinedEvent(playerId, joinAvatarId, joined.roomId);
  return joined;
}

export async function respondHelp(
  playerId: string,
  inviteId: string,
  accept: boolean,
  avatarId?: string,
): Promise<EncounterRoom | null> {
  const { getRoomInvitation } = await import('../db/postgresDocumentStore.js');
  const invitation = await getRoomInvitation<RoomInvitation>(inviteId);
  if (!invitation || invitation.toPlayerId !== playerId) {
    throw new RoomError('Invitation not found', 404, 'INVITE_NOT_FOUND');
  }

  if (invitation.status !== 'pending' || invitation.expiresAt <= nowMs()) {
    throw new RoomError('Invitation expired', 409, 'INVITE_EXPIRED');
  }

  invitation.status = accept ? 'accepted' : 'declined';
  await saveRoomInvitation(invitation);

  if (!accept) {
    return null;
  }

  const existingRoomId = await findActiveRoomIdForPlayer(playerId);
  if (existingRoomId && existingRoomId !== invitation.roomId) {
    await leaveRoom(playerId);
  }

  const joinAvatarId = await resolveHelpJoinAvatarId(playerId, avatarId);
  const room = await joinRoom(playerId, joinAvatarId, invitation.roomId);
  await recordHelpJoinedEvent(playerId, joinAvatarId, room.roomId);
  return room;
}

export async function listPendingHelpInvitations(playerId: string): Promise<RoomInvitation[]> {
  return loadPendingInvitations(playerId);
}
