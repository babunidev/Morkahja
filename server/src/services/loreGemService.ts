import { rollLoreGemClaimableAt } from '../domain/encounters/loreGemConstants.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { loadActiveEncounter, saveActiveEncounter } from './encounterPersistence.js';
import { addPlayerYellowRedGems, loadPlayer } from './playerService.js';
import {
  findActiveRoomIdForPlayer,
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
  encounterKey: string;
};

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

async function loadAuthoritativeSnapshot(
  playerId: string,
  avatarId: string,
): Promise<{ snapshot: EncounterSnapshot; room: EncounterRoom | null }> {
  const roomId = await findActiveRoomIdForPlayer(playerId);
  if (roomId) {
    const room = await loadEncounterRoom(roomId);
    if (room && room.roomState !== 'closed') {
      return { snapshot: room.activeEncounterSnapshot, room };
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
      encounterKey: activeSnapshot.snapshotId,
    };
  }

  const nowMs = Date.now();
  const roll = rollLoreGemClaimableAt(nowMs);
  const loreGemOffer = {
    eligible: roll.eligible,
    claimableAt: roll.claimableAt,
    offeredAt: nowMs,
  };

  await persistSnapshotWithOffer(activeSnapshot, loreGemOffer, room, playerId, avatarId);

  return {
    eligible: loreGemOffer.eligible,
    claimableAt: loreGemOffer.claimableAt,
    encounterKey: activeSnapshot.snapshotId,
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

  if (!activeSnapshot.loreGemOffer.eligible || activeSnapshot.loreGemOffer.claimableAt === null) {
    throw new LoreGemError('No lore gem is available for this encounter', 409);
  }

  const nowMs = Date.now();
  if (nowMs < activeSnapshot.loreGemOffer.claimableAt) {
    throw new LoreGemError('Lore gem is not ready to collect yet', 409);
  }

  const recipients = room
    ? activeRoomParticipants(room)
    : [{ playerId, avatarId }];

  let lastCurrencies: NonNullable<Awaited<ReturnType<typeof addPlayerYellowRedGems>>['currencies']> = {
    yellow_red_gem: 0,
  };
  let grantedAny = false;

  for (const recipient of recipients) {
    const claimKey = `${encounterKey}:${recipient.playerId}`;
    const player = await loadPlayer(recipient.playerId);
    if (player?.loreGemClaims?.[claimKey] === true) {
      continue;
    }

    const { currencies, granted } = await addPlayerYellowRedGems(
      recipient.playerId,
      1,
      claimKey,
    );
    lastCurrencies = currencies;
    grantedAny = grantedAny || granted;
  }

  if (!grantedAny) {
    throw new LoreGemError('Lore gem already claimed for this encounter', 409);
  }

  return { playerId, currencies: lastCurrencies, granted: grantedAny };
}
