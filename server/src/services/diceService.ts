import type { DiceId } from '@shared/diceCatalog.js';
import {
  DICE_UNLOCK_GEM_COST,
  DEFAULT_DICE_ID,
  DEFAULT_UNLOCKED_DICE_IDS,
  isDiceId,
  normalizeSelectedDiceId,
  normalizeUnlockedDiceIds,
} from '@shared/diceCatalog.js';
import type { PlayerDocument } from '../types/player.js';
import { getPlayer, setPlayer, withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { loadPlayer, readYellowRedGemBalance } from './playerService.js';

export class DiceNotFoundError extends Error {
  constructor() {
    super('Dice skin not found');
    this.name = 'DiceNotFoundError';
  }
}

export class DiceAlreadyUnlockedError extends Error {
  constructor() {
    super('Dice skin already unlocked');
    this.name = 'DiceAlreadyUnlockedError';
  }
}

export class InsufficientGemsForDiceError extends Error {
  constructor() {
    super('Insufficient yellow red gems for dice unlock');
    this.name = 'InsufficientGemsForDiceError';
  }
}

export class DiceNotUnlockedError extends Error {
  constructor() {
    super('Dice skin is not unlocked');
    this.name = 'DiceNotUnlockedError';
  }
}

export interface PlayerDiceState {
  unlockedDiceIds: DiceId[];
  selectedDiceId: DiceId;
}

export async function readPlayerDiceState(playerId: string): Promise<PlayerDiceState> {
  const player = await loadPlayer(playerId);

  if (!player) {
    return {
      unlockedDiceIds: [...DEFAULT_UNLOCKED_DICE_IDS],
      selectedDiceId: DEFAULT_DICE_ID,
    };
  }

  const unlockedDiceIds = normalizeUnlockedDiceIds(player.unlockedDiceIds);

  return {
    unlockedDiceIds,
    selectedDiceId: normalizeSelectedDiceId(player.selectedDiceId, unlockedDiceIds),
  };
}

export async function unlockPlayerDice(
  playerId: string,
  diceId: string,
): Promise<{
  currencies: NonNullable<PlayerDocument['currencies']>;
  unlockedDiceIds: DiceId[];
  diceId: DiceId;
  spent: number;
}> {
  if (!isDiceId(diceId)) {
    throw new DiceNotFoundError();
  }

  if (diceId === DEFAULT_DICE_ID) {
    throw new DiceAlreadyUnlockedError();
  }

  const { currencies, nextUnlockedDiceIds } = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);

    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const unlockedDiceIds = normalizeUnlockedDiceIds(player.unlockedDiceIds);

    if (unlockedDiceIds.includes(diceId)) {
      throw new DiceAlreadyUnlockedError();
    }

    const currentCurrencies = player.currencies ?? {};
    const currentGems = readYellowRedGemBalance(currentCurrencies);

    if (currentGems < DICE_UNLOCK_GEM_COST) {
      throw new InsufficientGemsForDiceError();
    }

    const nextCurrencies = {
      ...currentCurrencies,
      yellow_red_gem: currentGems - DICE_UNLOCK_GEM_COST,
    };
    const nextUnlocked = normalizeUnlockedDiceIds([...unlockedDiceIds, diceId]);

    await transaction.setPlayer(
      playerId,
      {
        currencies: nextCurrencies,
        unlockedDiceIds: nextUnlocked,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    return { currencies: nextCurrencies, nextUnlockedDiceIds: nextUnlocked };
  });

  return {
    currencies,
    unlockedDiceIds: nextUnlockedDiceIds,
    diceId,
    spent: DICE_UNLOCK_GEM_COST,
  };
}

export async function setPlayerSelectedDice(
  playerId: string,
  diceId: string,
): Promise<PlayerDiceState> {
  if (!isDiceId(diceId)) {
    throw new DiceNotFoundError();
  }

  const player = await getPlayer<Partial<PlayerDocument>>(playerId);

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const unlockedDiceIds = normalizeUnlockedDiceIds(player.unlockedDiceIds);

  if (!unlockedDiceIds.includes(diceId)) {
    throw new DiceNotUnlockedError();
  }

  await setPlayer(
    playerId,
    {
      selectedDiceId: diceId,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return {
    unlockedDiceIds,
    selectedDiceId: diceId,
  };
}
