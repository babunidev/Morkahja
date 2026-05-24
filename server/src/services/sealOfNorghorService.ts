import type { PlayerDocument } from '../types/player.js';
import {
  isSealOfNorghorActive,
  readSealOfNorghorExpiresAt,
  SEAL_OF_NORGHOR_DURATION_DAYS,
  SEAL_OF_NORGHOR_DURATION_MS,
  SEAL_OF_NORGHOR_GEM_COST,
  type SealOfNorghorRecord,
} from '../domain/subscription/sealOfNorghor.js';
import {
  loadPlayer,
  mergeUnlockedExpansionsWithSeal,
  readYellowRedGemBalance,
} from './playerService.js';
import { setPlayer } from '../db/postgresDocumentStore.js';

export interface SealOfNorghorStatus {
  active: boolean;
  expiresAt: number | null;
  cost: number;
  durationDays: number;
  gemBalance: number;
  canActivate: boolean;
}

export class SealOfNorghorAlreadyActiveError extends Error {
  constructor() {
    super('Seal of Norghor is already active');
    this.name = 'SealOfNorghorAlreadyActiveError';
  }
}

export class InsufficientGemsForSealError extends Error {
  constructor() {
    super('Insufficient yellow red gems for Seal of Norghor');
    this.name = 'InsufficientGemsForSealError';
  }
}

export function getSealExpiresAt(player: PlayerDocument | null): number | null {
  return readSealOfNorghorExpiresAt(player?.sealOfNorghor);
}

export function buildSealOfNorghorStatus(
  player: PlayerDocument | null,
  now = Date.now(),
): SealOfNorghorStatus {
  const expiresAt = getSealExpiresAt(player);
  const active = isSealOfNorghorActive(expiresAt, now);
  const gemBalance = readYellowRedGemBalance(player?.currencies);

  return {
    active,
    expiresAt: active ? expiresAt : null,
    cost: SEAL_OF_NORGHOR_GEM_COST,
    durationDays: SEAL_OF_NORGHOR_DURATION_DAYS,
    gemBalance,
    canActivate: !active && gemBalance >= SEAL_OF_NORGHOR_GEM_COST,
  };
}

export async function activateSealOfNorghor(
  playerId: string,
): Promise<{
  currencies: NonNullable<PlayerDocument['currencies']>;
  sealOfNorghor: SealOfNorghorStatus;
  spent: number;
  unlockedExpansions: number[];
}> {
  const player = await loadPlayer(playerId);

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const now = Date.now();
  const currentExpiresAt = getSealExpiresAt(player);

  if (isSealOfNorghorActive(currentExpiresAt, now)) {
    throw new SealOfNorghorAlreadyActiveError();
  }

  const currentCurrencies = player.currencies ?? {};
  const currentGems = readYellowRedGemBalance(currentCurrencies);

  if (currentGems < SEAL_OF_NORGHOR_GEM_COST) {
    throw new InsufficientGemsForSealError();
  }

  const expiresAt = now + SEAL_OF_NORGHOR_DURATION_MS;
  const sealOfNorghor: SealOfNorghorRecord = { expiresAt };
  const currencies = {
    ...currentCurrencies,
    yellow_red_gem: currentGems - SEAL_OF_NORGHOR_GEM_COST,
  };

  await setPlayer(
    playerId,
    {
      sealOfNorghor,
      currencies,
      updatedAt: now,
    },
    { merge: true },
  );

  const updatedPlayer: PlayerDocument = {
    ...player,
    sealOfNorghor,
    currencies,
  };
  const unlockedExpansions = mergeUnlockedExpansionsWithSeal(
    player.unlockedExpansions,
    expiresAt,
    now,
  );

  return {
    currencies,
    sealOfNorghor: buildSealOfNorghorStatus(updatedPlayer, now),
    spent: SEAL_OF_NORGHOR_GEM_COST,
    unlockedExpansions,
  };
}
