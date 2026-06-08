import { randomUUID } from 'node:crypto';
import type { EncounterAction } from '../../../shared/src/contracts.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type {
  ParticipantFocusState,
  ParticipantPreparedResult,
  RoomParticipant,
} from '../domain/rooms/RoomParticipant.js';
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
  ROOM_INACTIVITY_ENABLED,
  MAX_PARTICIPANTS,
  RANDOM_HELP_RECIPIENT_COUNT,
  ROOM_INVITE_TTL_MS,
} from '../domain/rooms/roomConstants.js';
import {
  withDocumentTransaction,
  getProgression,
  listPlayerIdsWithLiveSessions,
  type DocumentTransaction,
} from '../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../types/player.js';
import type { EncounterData } from '../engine/types.js';
import type { PlayerEncounterAction } from '../types/encounterSnapshot.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import type { AvatarDocument } from '../types/avatar.js';
import { applyExperience, type AvatarProgression } from '../domain/avatar/AvatarProgression.js';
import {
  formatAvatarDisplayName,
  readAvatarDisplayTitle,
} from '../domain/achievements/achievementTitles.js';
import {
  bindSnapshotToParticipant,
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
  shouldUseEncounterFollow,
  type ResolveParticipantInRoomResult,
} from './encounterGenerator.js';
import {
  ensureSlotEncounterSnapshots,
  seedAllSlotEncountersForRoom,
  snapshotForParticipant,
  syncActiveEncountersForRoom,
} from './roomEncounterSeeding.js';
import {
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
  listActiveRoomIdsForPlayer,
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
  recordRoomEncounterResolvedEvent,
  maybeRecordRoomEncounterStartedEvent,
} from './roomGameEvents.js';
import { isPlayerRecentlyActive } from './playerInteractionService.js';
import {
  applyLoreGemOfferToRoom,
  ensureRoomLoreGemOffer,
  participantsEarnedRoomLoreGem,
  roomLoreGemActivatedForSnapshot,
  withEncounterLoreGemOffer,
} from './loreGemService.js';

/**
 * Multiplayer room lifecycle (authoritative on server; clients poll GET /room/active).
 *
 * States: active_encounter → waiting_continue → advancing → active_encounter | system_event | closed
 * - choice: prepareParticipantOutcome → ready_to_continue; room may enter waiting_continue
 * - continue: continuePressed on continue targets; tickRoom commits + grantRoomLoreGemsOnCommit + advance
 * - inactivity (optional): tickInactivity (15s) or eager disengage when last engaged player submits choice
 * - host handoff: promoteHostAndReslot when leader leaves/dies/disconnects at encounter boundary
 */

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

function createParticipantForRoomJoin(
  room: EncounterRoom,
  playerId: string,
  avatarId: string,
  slotIndex: number,
): RoomParticipant {
  const participant = createParticipant(playerId, avatarId, slotIndex);

  if (room.roomState !== 'system_event' || !room.systemEvent) {
    return participant;
  }

  const currentItem = room.systemEvent.queue[room.systemEvent.queueIndex];
  const actorPlayerId = currentItem?.actorPlayerId ?? room.systemEvent.lastEvent?.actorPlayerId;
  if (playerId === actorPlayerId) {
    return participant;
  }

  return {
    ...participant,
    choiceState: 'witnessing',
    preparedResult: undefined,
    preparedCommit: undefined,
    resolutionSummary: undefined,
    selectedAction: undefined,
    selectedSolutionId: undefined,
    continuePressed: false,
    focusState: 'none',
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

function sortParticipantsForSystemEventQueue(
  room: EncounterRoom,
  participants: RoomParticipant[],
): RoomParticipant[] {
  return [...participants].sort((left, right) => {
    const leftIsLeader = left.playerId === room.leaderPlayerId;
    const rightIsLeader = right.playerId === room.leaderPlayerId;

    if (leftIsLeader && !rightIsLeader) {
      return -1;
    }

    if (rightIsLeader && !leftIsLeader) {
      return 1;
    }

    return left.slotIndex - right.slotIndex;
  });
}

export function buildPendingSystemEventQueue(
  room: EncounterRoom,
  participants: RoomParticipant[],
  pendingLevelUpByPlayerId: ReadonlyMap<string, boolean> = new Map(),
): RoomSystemEventQueueItem[] {
  const sorted = sortParticipantsForSystemEventQueue(room, participants);
  const queue: RoomSystemEventQueueItem[] = [];

  for (const participant of sorted) {
    const summary = participantOutcomeSummary(participant);
    const pendingFromAvatar = pendingLevelUpByPlayerId.get(participant.playerId) === true;

    if (!summary && !pendingFromAvatar) {
      continue;
    }

    const leveledUp = summary?.leveledUp === true || pendingFromAvatar;
    const deathTriggered = summary?.deathTriggered === true;

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
    } else if (pendingFromAvatar) {
      queue.push({
        actorPlayerId: participant.playerId,
        encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      });
    }
  }

  return queue;
}

async function loadPendingLevelUpFlagsForParticipants(
  participants: RoomParticipant[],
  readProgression: (
    playerId: string,
    avatarId: string,
  ) => Promise<Partial<AvatarProgression> | null>,
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();

  // One query at a time — readProgression may use a single transaction client.
  for (const participant of participants) {
    const progression = await readProgression(participant.playerId, participant.avatarId);
    if (progression?.pendingLevelUpRewards === true) {
      flags.set(participant.playerId, true);
    }
  }

  return flags;
}

function buildLineageFromRoomEncounter(room: EncounterRoom): RoomEncounterLineage {
  const snapshot = room.activeEncounterSnapshot;
  return {
    originEncounterId: snapshot.encounterId,
    originEncounterFollow: snapshot.encounterFollow,
    originRollOutcome: null,
    originSuccess: true,
  };
}

async function reconcilePendingLevelUpForRoom(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.roomState === 'closed' || room.roomState === 'system_event') {
    return room;
  }

  const engaged = engagedParticipants(room);
  if (engaged.length === 0) {
    return room;
  }

  const pendingFlags = await loadPendingLevelUpFlagsForParticipants(
    engaged,
    (playerId, avatarId) => getProgression(playerId, avatarId),
  );

  const pendingQueue = buildPendingSystemEventQueue(room, room.participants, pendingFlags)
    .filter((item) => item.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID);

  if (pendingQueue.length === 0) {
    return room;
  }

  const reconciled = await withDocumentTransaction(async (transaction) => {
    const current = await loadEncounterRoomFromTransaction(transaction, room.roomId);
    if (!current || current.roomState === 'closed' || current.roomState === 'system_event') {
      return current ?? room;
    }

    const engagedNow = engagedParticipants(current);
    const flagsNow = await loadPendingLevelUpFlagsForParticipants(
      engagedNow,
      (playerId, avatarId) => transaction.getProgression(playerId, avatarId),
    );

    const queueNow = buildPendingSystemEventQueue(current, current.participants, flagsNow)
      .filter((item) => item.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID);

    if (queueNow.length === 0) {
      return current;
    }

    const lineage = current.systemEvent?.lineage ?? buildLineageFromRoomEncounter(current);
    return beginSystemEventInTransaction(transaction, current, queueNow, lineage, 0);
  });

  return reconciled ?? room;
}

function currentSystemEventQueueItem(
  room: EncounterRoom,
): RoomSystemEventQueueItem | undefined {
  return room.systemEvent?.queue[room.systemEvent.queueIndex];
}

function requireCurrentSystemEventActor(room: EncounterRoom, playerId: string): void {
  const currentItem = currentSystemEventQueueItem(room);

  if (!currentItem || currentItem.actorPlayerId !== playerId) {
    throw new RoomError('Witnesses cannot submit choices', 403, 'WITNESS_READONLY');
  }
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

/** True when no other engaged adventurers are in the party (ghost/disengaged slots ignored). */
function isSoloPartyRoom(room: EncounterRoom): boolean {
  return engagedParticipants(room).length <= 1;
}

function isInactivePreparedResult(participant: RoomParticipant): boolean {
  return participant.preparedResult?.message === INACTIVE_OUTCOME_MESSAGE;
}

function reengageFromInactivity(
  room: EncounterRoom,
  playerId: string,
  now: number,
): EncounterRoom {
  const participant = findParticipant(room, playerId);
  if (!participant || participant.choiceState !== 'disengaged') {
    return room;
  }

  const inactiveDisengage = isInactivePreparedResult(participant);
  const hasRealPreparedOutcome = participant.preparedResult !== undefined && !inactiveDisengage;
  const wasWitnessToSystemEvent =
    room.systemEvent?.lastEvent !== undefined &&
    room.systemEvent.lastEvent.actorPlayerId !== participant.playerId;
  const restoredChoiceState =
    room.roomState === 'waiting_continue' &&
    (hasRealPreparedOutcome ||
      participant.resolutionSummary !== undefined ||
      wasWitnessToSystemEvent)
      ? (hasRealPreparedOutcome
        ? ('ready_to_continue' as const)
        : ('resolved' as const))
      : ('choosing' as const);

  return {
    ...room,
    participants: room.participants.map((entry) =>
      entry.playerId === playerId
        ? {
            ...entry,
            choiceState: restoredChoiceState,
            disconnectedAt: undefined,
            focusState: 'none',
            lastInteractionAt: now,
            ...(inactiveDisengage
              ? {
                  preparedResult: undefined,
                  preparedCommit: undefined,
                  selectedAction: undefined,
                  selectedSolutionId: undefined,
                  continuePressed: false,
                }
              : {}),
          }
        : entry,
    ),
    updatedAt: now,
  };
}

async function reengageParticipantIfNeeded(
  room: EncounterRoom,
  playerId: string,
): Promise<EncounterRoom> {
  const updated = reengageFromInactivity(room, playerId, nowMs());
  if (updated === room) {
    return room;
  }

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

/** Encounter pool for a room is always the leader's unlocked expansions only. */
async function expansionsForRoomLeader(room: EncounterRoom): Promise<number[]> {
  return mergeExpansionsForPlayerIds([room.leaderPlayerId]);
}

function previousEncounterFromRoom(room: EncounterRoom): EncounterData | null {
  const lastId = room.lastEncounterId;
  if (typeof lastId !== 'number' || lastId <= 0) {
    return null;
  }
  return getEncounterById(lastId) ?? null;
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

function slotZeroParticipant(room: EncounterRoom): RoomParticipant | undefined {
  const atSlotZero = room.participants.find((participant) => participant.slotIndex === 0);
  if (atSlotZero) {
    return atSlotZero;
  }

  const sorted = [...room.participants].sort((left, right) => left.slotIndex - right.slotIndex);
  return sorted[0];
}

function getRoomNextEncounter(
  currentSnapshot: EncounterSnapshot,
  room: EncounterRoom,
): EncounterData {
  const slotZero = slotZeroParticipant(room);
  const slotZeroSummary = slotZero ? participantOutcomeSummary(slotZero) : undefined;

  if (shouldUseEncounterFollow(currentSnapshot.encounterFollow, slotZeroSummary)) {
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

async function markPlayerKickedFromParty(playerId: string, roomId: string): Promise<void> {
  await savePlayerPresence({
    playerId,
    lastSeenAt: nowMs(),
    activeRoomId: undefined,
    state: 'online',
    lastPartyEjection: {
      reason: 'kicked',
      at: nowMs(),
      roomId,
    },
  });
}

export async function consumePartyEjection(playerId: string): Promise<'kicked' | undefined> {
  const existing = await loadPlayerPresence(playerId);
  if (existing?.lastPartyEjection?.reason !== 'kicked') {
    return undefined;
  }

  await savePlayerPresence({
    ...existing,
    lastSeenAt: nowMs(),
    activeRoomId: undefined,
    lastPartyEjection: undefined,
    state: existing.state === 'offline' ? 'offline' : 'online',
  });
  return 'kicked';
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

async function syncActiveEncountersInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
): Promise<void> {
  for (const participant of room.participants) {
    if (participant.choiceState === 'disengaged') {
      continue;
    }

    await transaction.setActiveEncounter(
      participant.playerId,
      participant.avatarId,
      bindSnapshotToParticipant(
        room.slotEncounterSnapshots[participant.slotIndex],
        participant.playerId,
        participant.avatarId,
      ),
    );
  }
}

const INACTIVE_OUTCOME_MESSAGE = 'Inactive';

function preparedInactiveOutcome(): ParticipantPreparedResult {
  return {
    success: false,
    message: INACTIVE_OUTCOME_MESSAGE,
    rewards: [],
  };
}

function disengageParticipantAsInactive(
  participant: RoomParticipant,
  now: number,
  autoContinue: boolean,
): RoomParticipant {
  return {
    ...participant,
    choiceState: 'disengaged',
    disconnectedAt: now,
    preparedResult: preparedInactiveOutcome(),
    preparedCommit: undefined,
    selectedAction: undefined,
    selectedSolutionId: undefined,
    ...(autoContinue ? { continuePressed: true } : {}),
  };
}

function disengageRemainingChoosers(
  participants: RoomParticipant[],
  now: number,
  autoContinue: boolean,
): RoomParticipant[] {
  if (!ROOM_INACTIVITY_ENABLED) {
    return participants;
  }

  return participants.map((participant) => {
    if (
      participant.choiceState !== 'choosing' ||
      participant.focusState !== 'none'
    ) {
      return participant;
    }

    return disengageParticipantAsInactive(participant, now, autoContinue);
  });
}

function applyAutoContinueForDisengaged(
  participants: RoomParticipant[],
): RoomParticipant[] {
  return participants.map((participant) =>
    participant.choiceState === 'disengaged'
      ? { ...participant, continuePressed: true }
      : participant,
  );
}

function promoteHostAndReslot(
  room: EncounterRoom,
  departingLeaderPlayerId: string,
): EncounterRoom {
  const remaining = room.participants
    .filter((participant) => participant.playerId !== departingLeaderPlayerId)
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const nextParticipants = remaining.map((participant, slotIndex) => ({
    ...participant,
    slotIndex,
  }));
  const newLeaderId = nextParticipants[0]?.playerId ?? departingLeaderPlayerId;

  return {
    ...room,
    leaderPlayerId: newLeaderId,
    participants: nextParticipants,
    updatedAt: nowMs(),
  };
}

function ensurePromotedLeaderForAdvance(room: EncounterRoom): EncounterRoom {
  const leader = findParticipant(room, room.leaderPlayerId);
  if (leader && leader.choiceState !== 'disengaged') {
    return room;
  }

  if (engagedParticipants(room).length === 0) {
    return room;
  }

  return promoteHostAndReslot(room, room.leaderPlayerId);
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
  if (!ROOM_INACTIVITY_ENABLED) {
    return room;
  }

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
      return disengageParticipantAsInactive(
        participant,
        now,
        room.roomState === 'waiting_continue',
      );
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

/** Clears prior encounter outcome so only the actor's new system-event roll counts. */
export function participantsAtSystemEventStart(
  participants: RoomParticipant[],
  actorPlayerId: string,
): RoomParticipant[] {
  return participants.map((participant) => {
    if (participant.choiceState === 'disengaged') {
      return participant;
    }

    const clearedOutcome = {
      preparedResult: undefined,
      preparedCommit: undefined,
      resolutionSummary: undefined,
      selectedAction: undefined,
      selectedSolutionId: undefined,
      continuePressed: false,
      focusState: 'none' as const,
    };

    if (participant.playerId === actorPlayerId) {
      return {
        ...participant,
        ...clearedOutcome,
        choiceState: 'choosing' as const,
      };
    }

    return {
      ...participant,
      ...clearedOutcome,
      choiceState: 'witnessing' as const,
    };
  });
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

  const prepared = preparedSystemEncounter(item.encounterId);

  const participants = participantsAtSystemEventStart(room.participants, item.actorPlayerId);

  const draftRoom: EncounterRoom = {
    ...room,
    participants,
    updatedAt: nowMs(),
  };
  let seededRoom = await seedAllSlotEncountersForRoom(
    draftRoom,
    systemEncounter,
    prepared,
  );
  const shellWithLore = withEncounterLoreGemOffer(seededRoom.activeEncounterSnapshot, nowMs());
  if (shellWithLore.loreGemOffer) {
    seededRoom = applyLoreGemOfferToRoom(seededRoom, shellWithLore.loreGemOffer);
  }

  const systemEventRoom: EncounterRoom = {
    ...seededRoom,
    roomState: 'system_event',
    systemEvent: {
      queue,
      queueIndex,
      lineage,
    },
    updatedAt: nowMs(),
  };

  await transaction.setEncounterRoom(room.roomId, systemEventRoom);
  await syncActiveEncountersInTransaction(transaction, systemEventRoom);

  return systemEventRoom;
}

function isActiveSystemEventActor(
  room: EncounterRoom,
  actorPlayerId: string,
): boolean {
  const actor = findParticipant(room, actorPlayerId);
  return !!actor && actor.choiceState !== 'disengaged';
}

function isSystemEventActorUnavailable(
  room: EncounterRoom,
  actorPlayerId: string,
): boolean {
  return !isActiveSystemEventActor(room, actorPlayerId);
}

function filterSystemEventQueueForActiveActors(
  room: EncounterRoom,
  queue: RoomSystemEventQueueItem[],
): RoomSystemEventQueueItem[] {
  return queue.filter((item) => isActiveSystemEventActor(room, item.actorPlayerId));
}

function isCurrentSystemEventStillValid(room: EncounterRoom): boolean {
  if (room.roomState !== 'system_event' || !room.systemEvent) {
    return false;
  }

  const currentItem = room.systemEvent.queue[room.systemEvent.queueIndex];
  if (!currentItem || !isActiveSystemEventActor(room, currentItem.actorPlayerId)) {
    return false;
  }

  return filterSystemEventQueueForActiveActors(room, room.systemEvent.queue).some(
    (item) =>
      item.actorPlayerId === currentItem.actorPlayerId &&
      item.encounterId === currentItem.encounterId &&
      item.chainedLevelUp === currentItem.chainedLevelUp,
  );
}

async function advanceSystemEventQueueInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  queue: RoomSystemEventQueueItem[],
  lineage: RoomEncounterLineage,
  queueIndex: number,
): Promise<EncounterRoom> {
  const remainingQueue = filterSystemEventQueueForActiveActors(
    room,
    queue.slice(queueIndex),
  );

  if (remainingQueue.length === 0) {
    return completeSystemEventQueueAfterActorSkipInTransaction(transaction, room, lineage);
  }

  return beginSystemEventInTransaction(
    transaction,
    room,
    remainingQueue,
    lineage,
    0,
  );
}

async function completeSystemEventQueueAfterActorSkipInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  lineage: RoomEncounterLineage,
): Promise<EncounterRoom> {
  const now = nowMs();
  const participants = applyAutoContinueForDisengaged(
    room.participants.map((participant) => {
      if (participant.choiceState === 'disengaged') {
        return participant;
      }

      return {
        ...participant,
        choiceState: 'resolved' as const,
        continuePressed: true,
        focusState: 'none' as const,
      };
    }),
  );

  const completedRoom: EncounterRoom = {
    ...room,
    participants,
    roomState: 'waiting_continue',
    systemEvent: {
      queue: [],
      queueIndex: 0,
      lineage,
    },
    updatedAt: now,
  };

  await transaction.setEncounterRoom(room.roomId, completedRoom);
  return completedRoom;
}

async function reconcileSystemEventIfActorUnavailableInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
): Promise<EncounterRoom> {
  if (room.roomState !== 'system_event' || !room.systemEvent) {
    return room;
  }

  if (isCurrentSystemEventStillValid(room)) {
    return room;
  }

  const { lineage } = room.systemEvent;
  const filteredQueue = filterSystemEventQueueForActiveActors(
    room,
    room.systemEvent.queue,
  );

  let working: EncounterRoom;

  if (filteredQueue.length === 0) {
    working = await completeSystemEventQueueAfterActorSkipInTransaction(
      transaction,
      room,
      lineage,
    );
  } else {
    working = await beginSystemEventInTransaction(
      transaction,
      room,
      filteredQueue,
      lineage,
      0,
    );
  }

  if (working.roomState === 'waiting_continue' && canAdvanceRoom(working)) {
    const advanced = await advanceWaitingRoomInTransaction(transaction, working);
    if (advanced) {
      working = advanced;
    }
  }

  return working;
}

async function reconcileSystemEventAfterParticipantDeparture(roomId: string): Promise<void> {
  const reconciled = await withDocumentTransaction(async (transaction) => {
    const room = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!room || room.roomState === 'closed') {
      return room;
    }

    return reconcileSystemEventIfActorUnavailableInTransaction(transaction, room);
  });

  if (reconciled && reconciled.roomState !== 'closed') {
    await syncActiveEncountersForRoom(reconciled);
  }
}

async function reconcileSystemEventForPoll(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.roomState !== 'system_event' || !room.systemEvent) {
    return room;
  }

  const item = room.systemEvent.queue[room.systemEvent.queueIndex];
  if (!item || !isSystemEventActorUnavailable(room, item.actorPlayerId)) {
    return room;
  }

  const reconciled = await withDocumentTransaction(async (transaction) => {
    const current = await loadEncounterRoomFromTransaction(transaction, room.roomId);
    if (!current) {
      return null;
    }

    return reconcileSystemEventIfActorUnavailableInTransaction(transaction, current);
  });

  if (!reconciled || reconciled.roomState === 'closed') {
    return reconciled ?? room;
  }

  await syncActiveEncountersForRoom(reconciled);
  return reconciled;
}

function participantSummaryFromResolve(
  result: ResolveParticipantInRoomResult,
): NonNullable<RoomParticipant['resolutionSummary']> {
  return preparedResultFromResolve(result);
}

function withRoomLoreGemOnResolutionSummary(
  room: EncounterRoom,
  participant: RoomParticipant,
  summary: ParticipantPreparedResult,
): ParticipantPreparedResult {
  if (participant.choiceState === 'disengaged') {
    return summary;
  }

  const snapshotId = room.activeEncounterSnapshot.snapshotId;
  if (!roomLoreGemActivatedForSnapshot(room, snapshotId)) {
    return summary;
  }

  return { ...summary, loreGemGranted: true };
}

function applyRoomXpBonusToCommitBundle(
  preparedCommit: NonNullable<RoomParticipant['preparedCommit']>,
  activeParticipantCount: number,
): NonNullable<RoomParticipant['preparedCommit']> {
  const bonusExperience = Math.max(0, activeParticipantCount);
  if (bonusExperience <= 0) {
    return preparedCommit;
  }

  const adjustedProgression = applyExperience(preparedCommit.nextProgression, bonusExperience);
  const leveledUpWithBonus = adjustedProgression.level > preparedCommit.nextProgression.level
    || preparedCommit.eventContext.leveledUp;

  return {
    ...preparedCommit,
    gainedExperience: preparedCommit.gainedExperience + bonusExperience,
    eventContext: {
      ...preparedCommit.eventContext,
      leveledUp: leveledUpWithBonus,
    },
    nextProgression: adjustedProgression,
    updatedAvatar: {
      ...preparedCommit.updatedAvatar,
      level: adjustedProgression.level,
      experience: adjustedProgression.experience,
    },
  };
}

async function grantRoomLoreGemsOnCommit(room: EncounterRoom): Promise<void> {
  const snapshotId = room.activeEncounterSnapshot.snapshotId;
  const recipients = participantsEarnedRoomLoreGem(room, snapshotId);

  for (const participant of recipients) {
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
  const activeParticipantCount = activeParticipants(room).length;
  let nextParticipants = [...room.participants];
  const commits = new Map<string, ResolveParticipantInRoomResult>();
  const now = nowMs();

  for (const participant of room.participants) {
    if (participant.choiceState === 'disengaged') {
      continue;
    }

    if (participant.preparedCommit && participant.selectedAction) {
      const commitBundle = applyRoomXpBonusToCommitBundle(
        participant.preparedCommit,
        activeParticipantCount,
      );
      const result = await commitPreparedOutcome(
        transaction,
        participant.playerId,
        participant.avatarId,
        commitBundle,
      );
      commits.set(participant.playerId, result);

      const summary = withRoomLoreGemOnResolutionSummary(
        room,
        participant,
        participantSummaryFromResolve(result),
      );
      nextParticipants = nextParticipants.map((entry) =>
        entry.playerId === participant.playerId
          ? {
              ...entry,
              choiceState: result.avatarDied ? 'disengaged' as const : entry.choiceState,
              disconnectedAt: result.avatarDied ? now : entry.disconnectedAt,
              resolutionSummary: summary,
              preparedResult: undefined,
              preparedCommit: undefined,
              loreGemCollected: summary.loreGemGranted === true ? true : entry.loreGemCollected,
            }
          : entry,
      );
    }
  }

  return { participants: nextParticipants, commits };
}

async function advanceWaitingRoomInTransaction(
  transaction: DocumentTransaction,
  room: EncounterRoom,
): Promise<EncounterRoom | null> {
  const roomId = room.roomId;
  if (room.roomState !== 'waiting_continue' || !canAdvanceRoom(room)) {
    return room;
  }

  const now = nowMs();
  const advancingRoom: EncounterRoom = {
    ...room,
    roomState: 'advancing',
    advanceStartedAt: room.advanceStartedAt ?? now,
    updatedAt: now,
  };
  await transaction.setEncounterRoom(roomId, advancingRoom);

  const commitResult = await commitPreparedResultsForRoom(transaction, advancingRoom);
  const committedRoom: EncounterRoom = {
    ...advancingRoom,
    participants: commitResult.participants,
  };

  await grantRoomLoreGemsOnCommit(committedRoom);

  return advanceRoomAfterCommit(
    transaction,
    committedRoom,
    commitResult.participants,
    commitResult.commits,
  );
}

async function advanceRoomAfterCommit(
  transaction: DocumentTransaction,
  room: EncounterRoom,
  committedParticipants: RoomParticipant[],
  commits: Map<string, ResolveParticipantInRoomResult>,
): Promise<EncounterRoom> {
  const roomId = room.roomId;
  let roomForAdvance = ensurePromotedLeaderForAdvance({
    ...room,
    participants: committedParticipants,
  });
  const committedAfterPromotion = roomForAdvance.participants;
  const participants = engagedParticipants(roomForAdvance);
  if (participants.length === 0) {
    const closed: EncounterRoom = {
      ...roomForAdvance,
      participants: committedAfterPromotion,
      roomState: 'closed',
      updatedAt: nowMs(),
    };
    await transaction.setEncounterRoom(roomId, closed);
    return closed;
  }

  const pendingFlags = await loadPendingLevelUpFlagsForParticipants(
    committedAfterPromotion,
    (playerId, avatarId) => transaction.getProgression(playerId, avatarId),
  );
  const pendingQueue = buildPendingSystemEventQueue(
    roomForAdvance,
    committedAfterPromotion,
    pendingFlags,
  );
  if (pendingQueue.length > 0) {
    const firstItem = pendingQueue[0]!;
    const actorResult = commits.get(firstItem.actorPlayerId);
    const lineage = actorResult
      ? buildLineageFromResolve(room.activeEncounterSnapshot, actorResult)
      : buildLineageFromRoomEncounter(roomForAdvance);
    const resolvedParticipantsRoom: EncounterRoom = {
      ...roomForAdvance,
      participants: committedAfterPromotion,
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

  const leader = findParticipant(roomForAdvance, roomForAdvance.leaderPlayerId)
    ?? participants[0];
  const lineage = roomForAdvance.systemEvent?.lineage;
  const lastEncounterId = lineage?.originEncounterId ?? roomForAdvance.activeEncounterSnapshot.encounterId;

  let nextEncounter: EncounterData;
  let preparedEncounter: ReturnType<typeof prepareNextEncounter>;
  if (lineage) {
    const resolved = resolveNextEncounterForRoom(lineage, roomForAdvance.mergedExpansions);
    nextEncounter = resolved.encounter;
    preparedEncounter = resolved.prepared;
  } else {
    nextEncounter = getRoomNextEncounter(roomForAdvance.activeEncounterSnapshot, {
      ...roomForAdvance,
      participants: committedAfterPromotion,
    });
    preparedEncounter = prepareNextEncounter(nextEncounter, roomForAdvance.mergedExpansions);
  }

  const advanceDraft: EncounterRoom = {
    ...roomForAdvance,
    lastEncounterId,
    helpCalledSnapshotId: undefined,
    systemEvent: undefined,
    loreGemActivated: undefined,
    loreGemActivatedSnapshotId: undefined,
    advanceStartedAt: undefined,
    participants: resetParticipantsForNewEncounter(committedAfterPromotion),
    roomState: 'active_encounter',
    updatedAt: nowMs(),
  };
  const advanced = await seedAllSlotEncountersForRoom(
    advanceDraft,
    nextEncounter,
    preparedEncounter,
  );

  await transaction.setEncounterRoom(roomId, advanced);
  await syncActiveEncountersInTransaction(transaction, advanced);

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
  const previousSnapshotId = room.activeEncounterSnapshot.snapshotId;
  const advanced = await withDocumentTransaction(async (transaction) => {
    const current = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!current || current.roomState !== 'waiting_continue' || !canAdvanceRoom(current)) {
      return current;
    }

    return advanceWaitingRoomInTransaction(transaction, current);
  });

  const result = advanced ?? room;
  if (
    advanced
    && advanced.roomState === 'active_encounter'
    && advanced.activeEncounterSnapshot.snapshotId !== previousSnapshotId
  ) {
    await maybeRecordRoomEncounterStartedEvent(advanced);
  }

  return result;
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
      actor.choiceState !== 'ready_to_continue'
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
        snapshotForParticipant(room, actor),
        actor.selectedAction,
      );

    const actorSummary = participantSummaryFromResolve(result);
    const now = nowMs();
    const deathEncounterChainedLevelUp =
      item.chainedLevelUp === true
      && room.activeEncounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID;
    const actorDied = result.avatarDied;

    let nextParticipants = room.participants.map((entry) =>
      entry.playerId === actor.playerId
        ? {
            ...entry,
            choiceState: actorDied ? 'disengaged' as const : 'resolved' as const,
            resolutionSummary: actorSummary,
            preparedResult: undefined,
            preparedCommit: undefined,
            ...(actorDied ? { disconnectedAt: now } : {}),
          }
        : entry,
    );

    let workingRoom: EncounterRoom = {
      ...room,
      participants: nextParticipants,
      updatedAt: now,
    };

    if (deathEncounterChainedLevelUp && !actorDied) {
      const nextQueue: RoomSystemEventQueueItem[] = [
        {
          actorPlayerId: item.actorPlayerId,
          encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        },
        ...filterSystemEventQueueForActiveActors(
          workingRoom,
          queue.slice(queueIndex + 1),
        ),
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
      return advanceSystemEventQueueInTransaction(
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

  if (room.roomState === 'system_event') {
    requireCurrentSystemEventActor(room, playerId);
  }

  const prepared = await prepareParticipantOutcome(
    transaction,
    playerId,
    participant.avatarId,
    snapshotForParticipant(room, participant),
    playerAction,
  );

  let nextParticipants = room.participants.map((entry) =>
    entry.playerId === playerId
      ? {
          ...entry,
          choiceState: 'ready_to_continue' as const,
          selectedAction: playerAction,
          selectedSolutionId: solutionId,
          preparedResult: withRoomLoreGemOnResolutionSummary(
            room,
            participant,
            prepared.preparedResult,
          ),
          preparedCommit: prepared.preparedCommit,
          resolutionSummary: undefined,
          lastInteractionAt: now,
        }
      : entry,
  );

  let workingParticipants = nextParticipants;
  const canWait = canEnterWaitingContinue({ ...room, participants: nextParticipants });
  if (canWait) {
    workingParticipants = disengageRemainingChoosers(nextParticipants, now, true);
    workingParticipants = applyAutoContinueForDisengaged(workingParticipants);
  }

  const nextRoomState = canWait && room.roomState !== 'system_event'
    ? 'waiting_continue'
    : room.roomState;

  const workingRoom: EncounterRoom = {
    ...room,
    participants: workingParticipants,
    roomState: nextRoomState,
    updatedAt: now,
  };

  await transaction.setEncounterRoom(room.roomId, workingRoom);
  return workingRoom;
}

export async function leaveRoomById(playerId: string, roomId: string): Promise<void> {
  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    await clearPresenceRoom(playerId);
    return;
  }

  if (!room.participants.some((participant) => participant.playerId === playerId)) {
    return;
  }

  const remaining = room.participants.filter((participant) => participant.playerId !== playerId);
  if (remaining.length === 0) {
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

  if (playerId === room.leaderPlayerId) {
    const promoted = promoteHostAndReslot(room, playerId);
    const updated: EncounterRoom = {
      ...promoted,
      mergedExpansions: await expansionsForRoomLeader(promoted),
    };
    await saveEncounterRoom(updated);
    await syncActiveEncountersForRoom(updated);
    await clearPresenceRoom(playerId);
    await reconcileSystemEventAfterParticipantDeparture(roomId);
    return;
  }

  const updated: EncounterRoom = {
    ...room,
    participants: remaining,
    updatedAt: nowMs(),
  };
  await saveEncounterRoom(updated);
  await clearPresenceRoom(playerId);
  await reconcileSystemEventAfterParticipantDeparture(roomId);
}

/** Leave every open room except an optional room the player is entering or reusing. */
export async function leaveOtherOpenRooms(
  playerId: string,
  keepRoomId?: string,
): Promise<void> {
  const roomIds = await listActiveRoomIdsForPlayer(playerId);
  for (const roomId of roomIds) {
    if (keepRoomId && roomId === keepRoomId) {
      continue;
    }
    await leaveRoomById(playerId, roomId);
  }
}

export async function leaveAllRoomsForPlayer(playerId: string): Promise<void> {
  const roomIds = await listActiveRoomIdsForPlayer(playerId);
  for (const roomId of roomIds) {
    await leaveRoomById(playerId, roomId);
  }
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
  await leaveOtherOpenRooms(playerId, existingRoomId ?? undefined);

  if (existingRoomId) {
    const existing = await loadEncounterRoom(existingRoomId);
    if (
      existing
      && existing.roomState !== 'closed'
      && findParticipant(existing, playerId)
    ) {
      return tickInactivity(await reconcilePendingLevelUpForRoom(await tickInactivity(existing)));
    }
  }

  const roomId = randomUUID();
  const leaderExpansions = await mergeExpansionsForPlayerIds([playerId]);
  const encounter = selectNextEncounter({
    unlockedExpansions: leaderExpansions,
    previousEncounter: previousEncounterFromAvatar(avatar),
  });
  const preparedEncounter = prepareNextEncounter(encounter, leaderExpansions);

  const draftRoom: EncounterRoom = {
    roomId,
    leaderPlayerId: playerId,
    participants: [createParticipant(playerId, avatarId, 0)],
    slotStates: DEFAULT_SLOT_STATES,
    mergedExpansions: leaderExpansions,
    activeEncounterSnapshot: buildEncounterSnapshot(
      playerId,
      avatarId,
      encounter,
      preparedEncounter,
      avatar,
    ),
    slotEncounterSnapshots: [
      buildEncounterSnapshot(playerId, avatarId, encounter, preparedEncounter, avatar),
      buildEncounterSnapshot(playerId, avatarId, encounter, preparedEncounter, avatar),
      buildEncounterSnapshot(playerId, avatarId, encounter, preparedEncounter, avatar),
    ],
    roomState: 'active_encounter',
    lastEncounterId: avatar.progression?.lastEncounterId,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };
  const room = await seedAllSlotEncountersForRoom(
    draftRoom,
    encounter,
    preparedEncounter,
  );

  await saveEncounterRoom(room);
  await syncActiveEncountersForRoom(room);
  await setPresenceInRoom(playerId, roomId);
  await maybeRecordRoomEncounterStartedEvent(room);
  return tickInactivity(await reconcilePendingLevelUpForRoom(room));
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
  if (!findParticipant(room, playerId)) {
    return null;
  }
  room = await ensureSlotEncounterSnapshots(room);
  room = await ensureRoomLoreGemOffer(room);
  room = await reconcilePendingLevelUpForRoom(room);
  room = await tickRoom(room);
  room = await reconcileSystemEventForPoll(room);
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

  await leaveOtherOpenRooms(playerId, roomId);

  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.participants.some((participant) => participant.playerId === playerId)) {
    return tickInactivity(await reconcilePendingLevelUpForRoom(await tickInactivity(room)));
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

  const roomWithJoiner = room.roomState === 'system_event'
    ? room
    : await ensureSlotEncounterSnapshots(room);
  const updated: EncounterRoom = {
    ...roomWithJoiner,
    participants: [
      ...roomWithJoiner.participants,
      createParticipantForRoomJoin(roomWithJoiner, playerId, avatarId, slotIndex),
    ],
    updatedAt: nowMs(),
  };

  await saveEncounterRoom(updated);
  await saveActiveEncounter(
    bindSnapshotToParticipant(
      updated.slotEncounterSnapshots[slotIndex],
      playerId,
      avatarId,
    ),
  );
  await setPresenceInRoom(playerId, roomId);
  return tickInactivity(await reconcilePendingLevelUpForRoom(updated));
}

export async function leaveRoom(playerId: string, avatarId?: string): Promise<void> {
  const roomId = avatarId
    ? await findActiveRoomIdForPlayerAvatar(playerId, avatarId)
    : await findCurrentAvatarRoomId(playerId);
  if (!roomId) {
    await clearPresenceRoom(playerId);
    return;
  }

  await leaveRoomById(playerId, roomId);
}

export async function kickParticipant(
  playerId: string,
  avatarId: string,
  targetPlayerId: string,
): Promise<EncounterRoom> {
  const room = await getActiveRoomForPlayer(playerId, avatarId);
  if (!room) {
    throw new RoomError('No active room', 404, 'NO_ROOM');
  }

  if (room.leaderPlayerId !== playerId) {
    throw new RoomError('Only the leader can kick players', 403, 'NOT_LEADER');
  }

  if (targetPlayerId === playerId) {
    throw new RoomError('Cannot kick yourself', 400, 'CANNOT_KICK_SELF');
  }

  const remaining = room.participants.filter((participant) => participant.playerId !== targetPlayerId);
  if (remaining.length === room.participants.length) {
    throw new RoomError('Player is not in this room', 404, 'NOT_IN_ROOM');
  }

  if (remaining.length === 0) {
    const closed: EncounterRoom = {
      ...room,
      participants: remaining,
      roomState: 'closed',
      updatedAt: nowMs(),
    };
    await saveEncounterRoom(closed);
    await markPlayerKickedFromParty(targetPlayerId, room.roomId);
    return closed;
  }

  const updated: EncounterRoom = {
    ...room,
    participants: remaining,
    updatedAt: nowMs(),
  };
  await saveEncounterRoom(updated);
  await markPlayerKickedFromParty(targetPlayerId, room.roomId);
  await reconcileSystemEventAfterParticipantDeparture(room.roomId);
  return updated;
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

  const existingRoom = await loadEncounterRoom(roomId);
  if (existingRoom) {
    await ensureSlotEncounterSnapshots(existingRoom);
  }

  const playerAction = clientActionToPlayerAction(action);
  const now = nowMs();

  const updated = await withDocumentTransaction(async (transaction) => {
    let room = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!room) {
      throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    room = reengageFromInactivity(room, playerId, now);
    await transaction.setEncounterRoom(roomId, room);

    if (room.roomState === 'system_event') {
      requireCurrentSystemEventActor(room, playerId);

      const participant = findParticipant(room, playerId);
      if (!participant || participant.choiceState === 'disengaged') {
        throw new RoomError('Not an active participant', 403, 'NOT_PARTICIPANT');
      }
      if (
        participant.choiceState === 'ready_to_continue' &&
        participant.preparedResult !== undefined
      ) {
        throw new RoomError(
          'System event outcome is already prepared',
          409,
          'OUTCOME_ALREADY_PREPARED',
        );
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

  if (updated.roomState === 'waiting_continue') {
    await recordRoomEncounterResolvedEvent(updated);
  }

  const ticked = await tickRoomById(roomId);
  return ticked ?? updated;
}

export async function submitSelection(
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
  const selectedSolutionId = action === 'dice' ? undefined : solutionId;
  if (action !== 'dice' && selectedSolutionId === undefined) {
    throw new RoomError('solutionId is required for solution actions', 400, 'SOLUTION_REQUIRED');
  }

  const now = nowMs();

  return withDocumentTransaction(async (transaction) => {
    let room = await loadEncounterRoomFromTransaction(transaction, roomId);
    if (!room) {
      throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    room = reengageFromInactivity(room, playerId, now);
    await transaction.setEncounterRoom(roomId, room);

    if (room.roomState === 'system_event') {
      requireCurrentSystemEventActor(room, playerId);
    } else if (room.roomState !== 'active_encounter') {
      throw new RoomError('Room is not accepting selections', 409, 'INVALID_ROOM_STATE');
    }

    if (!isEncounterActionReady(room.activeEncounterSnapshot)) {
      throw new RoomError('Action is not ready yet', 409, 'ACTION_NOT_READY');
    }

    const participant = findParticipant(room, playerId);
    if (!participant || participant.choiceState === 'disengaged') {
      throw new RoomError('Not an active participant', 403, 'NOT_PARTICIPANT');
    }

    if (
      participant.choiceState !== 'choosing' &&
      participant.choiceState !== 'ready'
    ) {
      throw new RoomError('Selection is locked', 409, 'SELECTION_LOCKED');
    }

    const updated: EncounterRoom = {
      ...room,
      participants: room.participants.map((entry) =>
        entry.playerId === playerId
          ? {
              ...entry,
              choiceState: 'ready' as const,
              selectedAction: playerAction,
              selectedSolutionId,
              lastInteractionAt: now,
            }
          : entry,
      ),
      updatedAt: now,
    };

    await transaction.setEncounterRoom(roomId, updated);
    return updated;
  });
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
    const reengaged = reengageFromInactivity(room, playerId, now);
    if (reengaged !== room) {
      room = reengaged;
      await saveEncounterRoom(room);
    }
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
  if (!room) {
    throw new RoomError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.roomState === 'system_event') {
    requireCurrentSystemEventActor(room, playerId);

    const actor = findParticipant(room, playerId);
    if (
      !actor ||
      actor.choiceState !== 'ready_to_continue' ||
      !actor.preparedResult
    ) {
      throw new RoomError('Room is not waiting to continue', 409, 'INVALID_ROOM_STATE');
    }

    const resolved = await tryResolveSystemEventIfReady(roomId);
    if (!resolved) {
      throw new RoomError('System event not ready to resolve', 409, 'SYSTEM_EVENT_NOT_READY');
    }

    if (resolved.roomState === 'waiting_continue') {
      await recordRoomEncounterResolvedEvent(resolved);
    }

    return resolved;
  }

  if (room.roomState !== 'waiting_continue' && room.roomState !== 'advancing') {
    throw new RoomError('Room is not waiting to continue', 409, 'INVALID_ROOM_STATE');
  }

  room = await ensureSlotEncounterSnapshots(room);
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

  if (canAdvanceRoom(withContinue)) {
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

  return isPlayerRecentlyActive(player, now);
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
  fromAvatarName: string,
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
      avatarName: fromAvatarName,
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
  const fromAvatarName = callerAvatar
    ? formatAvatarDisplayName(
      callerAvatar.name?.trim() || 'Adventurer',
      readAvatarDisplayTitle(callerAvatar),
    )
    : fromPlayerName;

  const eligibleFriendIds: string[] = [];
  for (const friendId of friendIds) {
    const friendPlayer = await loadPlayer(friendId);
    if (!friendPlayer || !isPlayerOnlineAndActive(friendPlayer, liveSessionPlayerIds, now)) {
      continue;
    }
    if (!(await canReceiveHelpInvite(fromPlayerId, friendId, room.roomId))) {
      continue;
    }
    eligibleFriendIds.push(friendId);
  }

  for (const friendId of eligibleFriendIds) {
    await sendHelpInvitation(
      fromPlayerId,
      friendId,
      room,
      fromPlayerName,
      fromAvatarName,
      avatarVisual,
    );
  }

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

  const strangerTargetIds = shufflePlayerIds(randomCandidates).slice(0, RANDOM_HELP_RECIPIENT_COUNT);
  for (const targetId of strangerTargetIds) {
    await sendHelpInvitation(
      fromPlayerId,
      targetId,
      room,
      fromPlayerName,
      fromAvatarName,
      avatarVisual,
    );
  }

  const updatedRoom: EncounterRoom = {
    ...room,
    helpCalledSnapshotId: snapshotId,
    updatedAt: now,
  };
  await saveEncounterRoom(updatedRoom);

  const invitedCount = eligibleFriendIds.length + strangerTargetIds.length;
  const targetMode: BroadcastCallForHelpResult['targetMode'] = strangerTargetIds.length > 0
    ? (eligibleFriendIds.length > 0 ? 'friends' : 'random')
    : (eligibleFriendIds.length > 0 ? 'friends' : 'random');

  return {
    invitedCount,
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
  const activeAvatar = await loadPlayerActiveAvatar(fromPlayerId);
  const callerAvatar = activeAvatar?.id
    ? await loadAvatar(fromPlayerId, activeAvatar.id)
    : null;
  const fromAvatarName = callerAvatar
    ? formatAvatarDisplayName(
      callerAvatar.name?.trim() || 'Adventurer',
      readAvatarDisplayTitle(callerAvatar),
    )
    : fromPlayerName;
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
      avatarName: fromAvatarName,
      ...(callerAvatar?.portrait ? { avatarPortrait: callerAvatar.portrait } : {}),
      ...(callerAvatar?.frame ? { avatarFrame: callerAvatar.frame } : {}),
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

/** Pending help invite only when it targets the friend's current active room. */
async function findValidHelpInviteFromFriend(
  viewerPlayerId: string,
  friendPlayerId: string,
): Promise<RoomInvitation | undefined> {
  const now = nowMs();
  const pendingInvites = await loadPendingInvitations(viewerPlayerId);
  const helpInvite = pendingInvites.find(
    (invite) => invite.fromPlayerId === friendPlayerId && invite.expiresAt > now,
  );
  if (!helpInvite) {
    return undefined;
  }

  const friendRoomId = await findActiveRoomIdForPlayer(friendPlayerId);
  if (!friendRoomId || helpInvite.roomId !== friendRoomId) {
    return undefined;
  }

  const room = await loadEncounterRoom(friendRoomId);
  if (!room || room.roomState === 'closed') {
    return undefined;
  }

  return helpInvite;
}

export function canViewerJoinRoom(
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

  const helpInvite = await findValidHelpInviteFromFriend(viewerPlayerId, friendPlayerId);
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

  const helpInvite = await findValidHelpInviteFromFriend(playerId, friendPlayerId);

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

  await leaveOtherOpenRooms(playerId, roomId);

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

  const callerRoomId = await findActiveRoomIdForPlayer(invitation.fromPlayerId);
  const targetRoomId = callerRoomId ?? invitation.roomId;
  if (targetRoomId !== invitation.roomId) {
    const targetRoom = await loadEncounterRoom(targetRoomId);
    if (!targetRoom || targetRoom.roomState === 'closed') {
      throw new RoomError('Invitation expired', 409, 'INVITE_EXPIRED');
    }
  }

  await leaveOtherOpenRooms(playerId, targetRoomId);

  const joinAvatarId = await resolveHelpJoinAvatarId(playerId, avatarId);
  const room = await joinRoom(playerId, joinAvatarId, targetRoomId);
  await recordHelpJoinedEvent(playerId, joinAvatarId, room.roomId);
  return room;
}

export async function listPendingHelpInvitations(playerId: string): Promise<RoomInvitation[]> {
  return loadPendingInvitations(playerId);
}

export async function resolveRoomJoinActionForViewer(
  viewingPlayerId: string,
  roomId: string,
): Promise<{ roomId: string; fromPlayerId: string } | null> {
  const room = await loadEncounterRoom(roomId);
  if (!room || room.roomState === 'closed') {
    return null;
  }

  const viewerRoomId = await findActiveRoomIdForPlayer(viewingPlayerId);
  if (viewerRoomId) {
    return null;
  }

  const leader = await loadPlayer(room.leaderPlayerId);
  const leaderFriendIds = leader?.friendIds ?? [];
  if (!canViewerJoinRoom(room, viewingPlayerId, leaderFriendIds)) {
    return null;
  }

  return {
    roomId: room.roomId,
    fromPlayerId: room.leaderPlayerId,
  };
}

/** Scribes/toast join targets the friend's current room, not a historical event room id. */
export async function resolveActivityFeedJoinAction(
  viewingPlayerId: string,
  friendPlayerId: string,
): Promise<{ roomId: string; fromPlayerId: string; inviteId?: string } | null> {
  const friendRoomId = await findActiveRoomIdForPlayer(friendPlayerId);
  if (!friendRoomId) {
    return null;
  }

  const joinable = await resolveRoomJoinActionForViewer(viewingPlayerId, friendRoomId);
  if (!joinable) {
    return null;
  }

  const helpInvite = await findValidHelpInviteFromFriend(viewingPlayerId, friendPlayerId);
  return {
    ...joinable,
    ...(helpInvite ? { inviteId: helpInvite.inviteId } : {}),
  };
}
