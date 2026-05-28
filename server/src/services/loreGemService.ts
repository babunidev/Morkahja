import { rollLoreGemClaimableAt } from '../domain/encounters/loreGemConstants.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { loadActiveEncounter, saveActiveEncounter } from './encounterPersistence.js';
import { addPlayerYellowRedGems, loadPlayer } from './playerService.js';
import {
  findActiveRoomIdForPlayerAvatar,
  loadEncounterRoom,
  saveEncounterRoom,
} from './roomPersistence.js';

export class LoreGemError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

export type LoreGemOfferResult = {
  eligible: boolean;
  claimableAt: number | null;
  durationMs: number;
  encounterKey: string;
};

function loreGemOfferDurationMs(
  offer: NonNullable<EncounterSnapshot['loreGemOffer']>,
): number {
  if (offer.durationMs > 0) {
    return offer.durationMs;
  }

  if (offer.claimableAt !== null && offer.offeredAt > 0) {
    return Math.max(0, offer.claimableAt - offer.offeredAt);
  }

  return 0;
}

function assertActiveEncounterForLore(
  snapshot: EncounterSnapshot | null,
  encounterKey?: string,
): EncounterSnapshot {
  if (!snapshot) {
    throw new LoreGemError('No active encounter', 404);
  }

  if (snapshot.state !== 'active' || snapshot.resolved) {
    throw new LoreGemError('Encounter is not active', 409);
  }

  if (encounterKey && snapshot.snapshotId !== encounterKey) {
    throw new LoreGemError('Encounter snapshot mismatch', 409);
  }

  return snapshot;
}

function activeRoomParticipants(room: EncounterRoom) {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
}

export function createLoreGemOffer(
  nowMs: number = Date.now(),
): NonNullable<EncounterSnapshot['loreGemOffer']> {
  const roll = rollLoreGemClaimableAt(nowMs);
  return {
    eligible: roll.eligible,
    claimableAt: roll.claimableAt,
    offeredAt: nowMs,
    durationMs: roll.durationMs,
  };
}

/** Attach a room encounter lore gem timer when the encounter starts (idempotent). */
export function withEncounterLoreGemOffer(
  snapshot: EncounterSnapshot,
  nowMs: number = Date.now(),
): EncounterSnapshot {
  if (snapshot.loreGemOffer) {
    return snapshot;
  }

  return {
    ...snapshot,
    loreGemOffer: createLoreGemOffer(nowMs),
  };
}

export async function ensureRoomLoreGemOffer(room: EncounterRoom): Promise<EncounterRoom> {
  if (room.activeEncounterSnapshot.loreGemOffer) {
    return room;
  }

  const nowMs = Date.now();
  const updatedRoom: EncounterRoom = {
    ...room,
    activeEncounterSnapshot: withEncounterLoreGemOffer(room.activeEncounterSnapshot, nowMs),
    updatedAt: nowMs,
  };
  await saveEncounterRoom(updatedRoom);
  await Promise.all(
    activeRoomParticipants(updatedRoom).map((participant) =>
      saveActiveEncounter({
        ...updatedRoom.activeEncounterSnapshot,
        playerId: participant.playerId,
        avatarId: participant.avatarId,
      }),
    ),
  );
  return updatedRoom;
}

async function loadAuthoritativeSnapshot(
  playerId: string,
  avatarId: string,
): Promise<{ snapshot: EncounterSnapshot; room: EncounterRoom | null }> {
  const roomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (roomId) {
    const room = await loadEncounterRoom(roomId);
    if (room && room.roomState !== 'closed') {
      const withOffer = await ensureRoomLoreGemOffer(room);
      return { snapshot: withOffer.activeEncounterSnapshot, room: withOffer };
    }
  }

  return {
    snapshot: assertActiveEncounterForLore(await loadActiveEncounter(playerId, avatarId)),
    room: null,
  };
}

async function persistSnapshotWithOffer(
  snapshot: EncounterSnapshot,
  loreGemOffer: NonNullable<EncounterSnapshot['loreGemOffer']>,
  room: EncounterRoom | null,
  playerId: string,
  avatarId: string,
): Promise<void> {
  const nextSnapshot: EncounterSnapshot = {
    ...snapshot,
    loreGemOffer,
  };

  if (room) {
    const updatedRoom: EncounterRoom = {
      ...room,
      activeEncounterSnapshot: nextSnapshot,
      updatedAt: Date.now(),
    };
    await saveEncounterRoom(updatedRoom);
    await Promise.all(
      activeRoomParticipants(updatedRoom).map((participant) =>
        saveActiveEncounter({
          ...nextSnapshot,
          playerId: participant.playerId,
          avatarId: participant.avatarId,
        }),
      ),
    );
    return;
  }

  await saveActiveEncounter({
    ...nextSnapshot,
    playerId,
    avatarId,
  });
}

export async function offerLoreGem(
  playerId: string,
  avatarId: string,
): Promise<LoreGemOfferResult> {
  const { snapshot, room } = await loadAuthoritativeSnapshot(playerId, avatarId);
  const activeSnapshot = assertActiveEncounterForLore(snapshot);

  if (activeSnapshot.loreGemOffer) {
    return {
      eligible: activeSnapshot.loreGemOffer.eligible,
      claimableAt: activeSnapshot.loreGemOffer.claimableAt,
      durationMs: loreGemOfferDurationMs(activeSnapshot.loreGemOffer),
      encounterKey: activeSnapshot.snapshotId,
    };
  }

  const nowMs = Date.now();
  const loreGemOffer = createLoreGemOffer(nowMs);

  await persistSnapshotWithOffer(activeSnapshot, loreGemOffer, room, playerId, avatarId);

  return {
    eligible: loreGemOffer.eligible,
    claimableAt: loreGemOffer.claimableAt,
    durationMs: loreGemOffer.durationMs,
    encounterKey: activeSnapshot.snapshotId,
  };
}

/** Room sessions: mark gem collected; currency grants on room commit tick. */
export async function activateRoomLoreGem(
  playerId: string,
  avatarId: string,
  encounterKey: string,
): Promise<{ activated: boolean; encounterKey: string; room: EncounterRoom }> {
  if (!encounterKey.trim()) {
    throw new LoreGemError('encounterKey is required');
  }

  const { snapshot, room } = await loadAuthoritativeSnapshot(playerId, avatarId);
  if (!room) {
    throw new LoreGemError('Room lore gem activation requires an active room', 409);
  }

  const activeSnapshot = assertActiveEncounterForLore(snapshot, encounterKey);

  if (!activeSnapshot.loreGemOffer) {
    throw new LoreGemError('Lore gem has not been offered for this encounter');
  }

  if (
    !activeSnapshot.loreGemOffer.eligible
    || loreGemOfferDurationMs(activeSnapshot.loreGemOffer) <= 0
  ) {
    throw new LoreGemError('No lore gem is available for this encounter', 409);
  }

  const nowMs = Date.now();

  if (
    room.loreGemActivated === true &&
    room.loreGemActivatedSnapshotId === activeSnapshot.snapshotId &&
    room.participants.some(
      (participant) =>
        participant.playerId === playerId && participant.loreGemCollected === true,
    )
  ) {
    return {
      activated: true,
      encounterKey: activeSnapshot.snapshotId,
      room,
    };
  }

  const updatedRoom: EncounterRoom = {
    ...room,
    loreGemActivated: true,
    loreGemActivatedSnapshotId: activeSnapshot.snapshotId,
    participants: room.participants.map((participant) =>
      participant.playerId === playerId
        ? { ...participant, loreGemCollected: true }
        : participant,
    ),
    updatedAt: nowMs,
  };
  await saveEncounterRoom(updatedRoom);

  return {
    activated: true,
    encounterKey: activeSnapshot.snapshotId,
    room: updatedRoom,
  };
}

export async function claimLoreGem(
  playerId: string,
  avatarId: string,
  encounterKey: string,
): Promise<{
  playerId: string;
  currencies: NonNullable<Awaited<ReturnType<typeof addPlayerYellowRedGems>>['currencies']>;
  granted: boolean;
}> {
  if (!encounterKey.trim()) {
    throw new LoreGemError('encounterKey is required');
  }

  const { snapshot, room } = await loadAuthoritativeSnapshot(playerId, avatarId);
  const activeSnapshot = assertActiveEncounterForLore(snapshot, encounterKey);

  if (!activeSnapshot.loreGemOffer) {
    throw new LoreGemError('Lore gem has not been offered for this encounter');
  }

  if (
    !activeSnapshot.loreGemOffer.eligible
    || loreGemOfferDurationMs(activeSnapshot.loreGemOffer) <= 0
  ) {
    throw new LoreGemError('No lore gem is available for this encounter', 409);
  }

  const nowMs = Date.now();

  if (room) {
    const activation = await activateRoomLoreGem(playerId, avatarId, encounterKey);
    const player = await loadPlayer(playerId);
    return {
      playerId,
      currencies: player?.currencies ?? { yellow_red_gem: 0 },
      granted: activation.activated,
    };
  }

  const claimKey = `${encounterKey}:${playerId}`;
  const player = await loadPlayer(playerId);
  if (player?.loreGemClaims?.[claimKey] === true) {
    throw new LoreGemError('Lore gem already claimed for this encounter', 409);
  }

  const { currencies, granted } = await addPlayerYellowRedGems(playerId, 1, claimKey);
  if (!granted) {
    throw new LoreGemError('Lore gem already claimed for this encounter', 409);
  }

  return { playerId, currencies, granted };
}
