import {
  isSpecializationType,
  readAvatarSpecialization,
  specializationChangeCost,
  specializationFreeChanges,
} from '@shared/specialization.js';
import type { AvatarDocument, AvatarInventory } from '../types/avatar.js';
import { avatarHeldSpecializationTypes } from './avatarPresentation.js';
import type { PlayerDocument } from '../types/player.js';
import { getPlayer, pool, withDocumentTransaction } from '../db/postgresDocumentStore.js';
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
 * free; a change uses a free change first and otherwise costs 1 gem. Only a
 * type of skill the avatar holds can be chosen, and every type it holds for
 * the first time adds a free change (Babuni, 2026-11-26). The avatar and the player rows are locked
 * in one transaction, so the gem balance and the specialization change
 * together. Choosing the one it already has changes nothing and costs nothing.
 */
export async function chooseAvatarSpecialization(
  playerId: string,
  avatarId: string,
  specialization: number,
): Promise<{ specialization: number; spent: number; freeChanges: number; currencies: PlayerDocument['currencies'] }> {
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
    // The inventory row is authoritative; the avatar's copy is a cache.
    const inventory = (await transaction.getInventory<AvatarInventory>(playerId, avatarId)) ?? avatar.inventory;
    const held = avatarHeldSpecializationTypes(inventory);
    const { free, seen } = specializationFreeChanges(avatar, held);
    if (current === specialization) {
      return { specialization, spent: 0, freeChanges: free, currencies };
    }
    if (!held.includes(specialization)) {
      throw new SpecializationRequestError('This avatar has no skill of that type', 409, 'SPECIALIZATION_NOT_HELD');
    }

    const cost = specializationChangeCost(current, free);
    const usesFreeChange = current !== null && free > 0;
    const gems = readYellowRedGemBalance(currencies);
    if (gems < cost) {
      throw new SpecializationRequestError('Not enough gems to change the specialization', 409, 'INSUFFICIENT_GEMS');
    }

    const nextCurrencies = cost > 0 ? { ...currencies, yellow_red_gem: gems - cost } : currencies;
    if (cost > 0) {
      await transaction.setPlayer(playerId, { currencies: nextCurrencies, updatedAt: Date.now() }, { merge: true });
    }
    const freeChanges = usesFreeChange ? free - 1 : free;
    await transaction.setAvatar(playerId, avatarId, {
      specialization,
      specializationTypesSeen: seen,
      specializationFreeChanges: freeChanges,
    } as never, { merge: true });
    return { specialization, spent: cost, freeChanges, currencies: nextCurrencies };
  });
}

/**
 * At start-up: every avatar that has no record of its skill types yet gets
 * one from what it holds now, so existing avatars earn free changes from here
 * on and not for skills they already had. Returns how many were recorded.
 */
export async function syncSpecializationProgressForAllAvatars(): Promise<number> {
  // Any store read creates missing tables first, so the query cannot fail on a fresh database.
  await getPlayer('specialization-schema-check');
  const result = await pool.query<{ player_id: string; id: string }>(
    `SELECT player_id, id FROM avatars WHERE NOT (data ? 'specializationTypesSeen')`,
  );
  let recorded = 0;
  for (const row of result.rows) {
    const done = await withDocumentTransaction(async (transaction) => {
      const avatar = await transaction.getAvatar<AvatarDocument>(row.player_id, row.id);
      if (!avatar || Array.isArray(avatar.specializationTypesSeen)) {
        return false;
      }
      const inventory = (await transaction.getInventory<AvatarInventory>(row.player_id, row.id)) ?? avatar.inventory;
      await transaction.setAvatar(row.player_id, row.id, {
        specializationTypesSeen: avatarHeldSpecializationTypes(inventory),
        specializationFreeChanges: avatar.specializationFreeChanges ?? 0,
      } as never, { merge: true });
      return true;
    });
    if (done) {
      recorded += 1;
    }
  }
  return recorded;
}
