import {
  isSpecializationType,
  readAvatarSpecialization,
  specializationChangeCost,
} from '@shared/specialization.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { readAvatarLifeStatus } from './avatarDeathService.js';
import { readYellowRedGemBalance } from './playerService.js';

export class SpecializationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Choose or change an avatar's specialization (D-056). The first choice is
 * free; every change costs 1 gem. The avatar and the player rows are locked
 * in one transaction, so the gem balance and the specialization change
 * together. Choosing the one it already has changes nothing and costs nothing.
 */
export async function chooseAvatarSpecialization(
  playerId: string,
  avatarId: string,
  specialization: number,
): Promise<{ specialization: number; spent: number; currencies: PlayerDocument['currencies'] }> {
  if (!isSpecializationType(specialization)) {
    throw new SpecializationRequestError('Unknown specialization', 400, 'UNKNOWN_SPECIALIZATION');
  }

  return withDocumentTransaction(async (transaction) => {
    // Avatar first, then player: the same lock order as an encounter's Continue.
    const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
    if (!avatar) {
      throw new SpecializationRequestError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
    }
    if (readAvatarLifeStatus(avatar) !== 'active') {
      throw new SpecializationRequestError('This avatar cannot change its specialization', 409, 'AVATAR_NOT_ACTIVE');
    }
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      throw new SpecializationRequestError('Player not found', 404, 'PLAYER_NOT_FOUND');
    }

    const current = readAvatarSpecialization(avatar);
    const currencies = player.currencies ?? {};
    if (current === specialization) {
      return { specialization, spent: 0, currencies };
    }

    const cost = specializationChangeCost(current);
    const gems = readYellowRedGemBalance(currencies);
    if (gems < cost) {
      throw new SpecializationRequestError('Not enough gems to change the specialization', 409, 'INSUFFICIENT_GEMS');
    }

    const nextCurrencies = cost > 0 ? { ...currencies, yellow_red_gem: gems - cost } : currencies;
    if (cost > 0) {
      await transaction.setPlayer(playerId, { currencies: nextCurrencies, updatedAt: Date.now() }, { merge: true });
    }
    await transaction.setAvatar(playerId, avatarId, { specialization } as never, { merge: true });
    return { specialization, spent: cost, currencies: nextCurrencies };
  });
}
