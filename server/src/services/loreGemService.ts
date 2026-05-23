import { rollLoreGemClaimableAt } from '../domain/encounters/loreGemConstants.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { loadActiveEncounter, saveActiveEncounter } from './encounterPersistence.js';
import { addPlayerYellowRedGems, loadPlayer } from './playerService.js';

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

export async function offerLoreGem(
  playerId: string,
  avatarId: string,
): Promise<LoreGemOfferResult> {
  const snapshot = assertActiveEncounterForLore(
    await loadActiveEncounter(playerId, avatarId),
  );

  if (snapshot.loreGemOffer) {
    return {
      eligible: snapshot.loreGemOffer.eligible,
      claimableAt: snapshot.loreGemOffer.claimableAt,
      encounterKey: snapshot.snapshotId,
    };
  }

  const nowMs = Date.now();
  const roll = rollLoreGemClaimableAt(nowMs);
  const loreGemOffer = {
    eligible: roll.eligible,
    claimableAt: roll.claimableAt,
    offeredAt: nowMs,
  };

  await saveActiveEncounter({
    ...snapshot,
    loreGemOffer,
  });

  return {
    eligible: loreGemOffer.eligible,
    claimableAt: loreGemOffer.claimableAt,
    encounterKey: snapshot.snapshotId,
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

  const snapshot = assertActiveEncounterForLore(
    await loadActiveEncounter(playerId, avatarId),
    encounterKey,
  );

  if (!snapshot.loreGemOffer) {
    throw new LoreGemError('Lore gem has not been offered for this encounter');
  }

  if (!snapshot.loreGemOffer.eligible || snapshot.loreGemOffer.claimableAt === null) {
    throw new LoreGemError('No lore gem is available for this encounter', 409);
  }

  const nowMs = Date.now();
  if (nowMs < snapshot.loreGemOffer.claimableAt) {
    throw new LoreGemError('Lore gem is not ready to collect yet', 409);
  }

  const player = await loadPlayer(playerId);
  if (player?.loreGemClaims?.[encounterKey] === true) {
    throw new LoreGemError('Lore gem already claimed for this encounter', 409);
  }

  const { currencies, granted } = await addPlayerYellowRedGems(
    playerId,
    1,
    encounterKey,
  );

  return { playerId, currencies, granted };
}
