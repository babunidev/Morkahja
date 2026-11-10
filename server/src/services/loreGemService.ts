import { rollLoreGemClaimableAt } from '../domain/encounters/loreGemConstants.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import {
  alignSnapshotToRoomShell,
  bindSnapshotToParticipant,
  type SlotEncounterSnapshots,
} from './encounterGenerator.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
import {
  findActiveRoomIdForPlayerAvatar,
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

/** Lore gems can be collected during waiting_continue (e.g. lore open after Continue). */
function assertLoreGemCollectibleForRoom(
  snapshot: EncounterSnapshot | null,
  room: EncounterRoom,
  encounterKey?: string,
): EncounterSnapshot {
  if (!snapshot) {
    throw new LoreGemError('No active encounter', 404);
  }

  if (encounterKey && snapshot.snapshotId !== encounterKey) {
    throw new LoreGemError('Encounter snapshot mismatch', 409);
  }

  if (room.roomState === 'waiting_continue' || room.roomState === 'advancing') {
    return snapshot;
  }

  return assertActiveEncounterForLore(snapshot, encounterKey);
}

function activeRoomParticipants(room: EncounterRoom) {
  return room.participants.filter((participant) => participant.choiceState !== 'disengaged');
}

export function roomLoreGemActivatedForSnapshot(
  room: EncounterRoom,
  snapshotId: string,
): boolean {
  return (
    room.loreGemActivated === true
    && room.loreGemActivatedSnapshotId === snapshotId
  );
}

/** Active participants who earn the room lore gem for this encounter snapshot. */
export function participantsEarnedRoomLoreGem(
  room: EncounterRoom,
  snapshotId: string,
): EncounterRoom['participants'] {
  if (!roomLoreGemActivatedForSnapshot(room, snapshotId)) {
    return [];
  }

  return activeRoomParticipants(room);
}

export function applyLoreGemOfferToRoom(
  room: EncounterRoom,
  loreGemOffer: NonNullable<EncounterSnapshot['loreGemOffer']>,
): EncounterRoom {
  const shellSnapshot: EncounterSnapshot = {
    ...room.activeEncounterSnapshot,
    loreGemOffer,
  };
  const slotEncounterSnapshots = room.slotEncounterSnapshots.map((snapshot) =>
    alignSnapshotToRoomShell(shellSnapshot, {
      ...snapshot,
      loreGemOffer,
    }),
  ) as SlotEncounterSnapshots;

  return {
    ...room,
    activeEncounterSnapshot: shellSnapshot,
    slotEncounterSnapshots,
  };
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

  return withDocumentTransaction(async (transaction) => {
    const current = await transaction.getEncounterRoom<EncounterRoom>(room.roomId);
    if (!current || current.roomState === 'closed') {
      return room;
    }
    if (current.activeEncounterSnapshot.loreGemOffer) {
      return current;
    }
    const offer = createLoreGemOffer(Date.now());
    const updated: EncounterRoom = {
      ...applyLoreGemOfferToRoom(current, offer),
      updatedAt: Date.now(),
    };
    await transaction.setEncounterRoom(updated.roomId, updated);
    for (const participant of activeRoomParticipants(updated)) {
      await transaction.setActiveEncounter(
        participant.playerId, participant.avatarId,
        bindSnapshotToParticipant(
          updated.slotEncounterSnapshots[participant.slotIndex],
          participant.playerId, participant.avatarId,
        ),
      );
    }
    return updated;
  });
}

function assertLoreGemReady(offer: EncounterSnapshot['loreGemOffer'], now: number): void {
  if (!offer || !offer.eligible || offer.claimableAt === null
    || loreGemOfferDurationMs(offer) <= 0) {
    throw new LoreGemError('No lore gem is available for this encounter', 409);
  }
  if (now < offer.claimableAt) {
    throw new LoreGemError('Lore gem is not yet claimable', 409);
  }
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

  const roomId = await findActiveRoomIdForPlayerAvatar(playerId, avatarId);
  if (!roomId) {
    throw new LoreGemError('Room lore gem activation requires an active room', 409);
  }

  return withDocumentTransaction(async (transaction) => {
    const room = await transaction.getEncounterRoom<EncounterRoom>(roomId);
    if (!room || room.roomState === 'closed') {
      throw new LoreGemError('No active room', 404);
    }
    const participant = room.participants.find((entry) =>
      entry.playerId === playerId && entry.avatarId === avatarId);
    if (!participant || participant.choiceState === 'disengaged') {
      throw new LoreGemError('Inactive players cannot collect lore gems', 403);
    }

    const snapshot = room.slotEncounterSnapshots[participant.slotIndex]
      ?? room.activeEncounterSnapshot;
    const activeSnapshot = assertLoreGemCollectibleForRoom(snapshot, room, encounterKey);
    assertLoreGemReady(activeSnapshot.loreGemOffer, Date.now());

    if (
      room.loreGemActivated === true &&
      room.loreGemActivatedSnapshotId === activeSnapshot.snapshotId &&
      participant.loreGemCollected === true
    ) {
      return { activated: true, encounterKey: activeSnapshot.snapshotId, room };
    }

    // This is a shared-room gem: one valid activation marks all engaged
    // participants eligible for the single grant at room commit.
    const updatedRoom: EncounterRoom = {
      ...room,
      loreGemActivated: true,
      loreGemActivatedSnapshotId: activeSnapshot.snapshotId,
      participants: room.participants.map((entry) =>
        entry.choiceState === 'disengaged'
          ? entry
          : { ...entry, loreGemCollected: true },
      ),
      updatedAt: Date.now(),
    };
    await transaction.setEncounterRoom(roomId, updatedRoom);
    return { activated: true, encounterKey: activeSnapshot.snapshotId, room: updatedRoom };
  });
}
