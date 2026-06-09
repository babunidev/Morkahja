import type { AvatarDocument, AvatarPreDeathSnapshot } from '../types/avatar.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';
import { loadInventory } from './inventoryService.js';
import { loadAvatarProgression } from './avatarProgressionService.js';
import { recordWallOfFameEntry } from './playerProfileService.js';
import { clearSoloCheckpointForAvatar } from './soloRoomCheckpointService.js';
import {
  readYellowRedGemBalance,
} from './playerService.js';
import type { PlayerDocument } from '../types/player.js';

export class AvatarDeathError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AvatarDeathError';
  }
}

export class InsufficientGemsForSacrificeError extends AvatarDeathError {
  constructor() {
    super('Insufficient gems for sacrifice', 409, 'INSUFFICIENT_GEMS');
  }
}

export function sacrificeCostForLevel(level: number): number {
  return Math.max(1, level) * 10;
}

export function readAvatarLifeStatus(avatar: AvatarDocument): AvatarDocument['status'] {
  return avatar.status ?? 'active';
}

function buildPreDeathSnapshot(
  avatar: AvatarDocument,
  inventory: AvatarDocument['inventory'],
  progression: AvatarPreDeathSnapshot['progression'],
): AvatarPreDeathSnapshot {
  return {
    level: typeof avatar.level === 'number' ? avatar.level : 1,
    experience: typeof avatar.experience === 'number' ? avatar.experience : 0,
    inventory: inventory ?? { spellbook: [], items: [], essences: [] },
    progression,
    lastPlayedAt: avatar.lastPlayedAt,
    failedAt: Date.now(),
  };
}

export function applyFailedDeathState(
  avatar: AvatarDocument,
  inventory: AvatarDocument['inventory'],
  progression: AvatarPreDeathSnapshot['progression'],
): AvatarDocument {
  const preDeathSnapshot = buildPreDeathSnapshot(avatar, inventory, progression);

  return {
    ...avatar,
    status: 'failed',
    preDeathSnapshot,
    inventory: preDeathSnapshot.inventory,
  };
}

export async function sacrificeFailedAvatar(
  playerId: string,
  avatarId: string,
): Promise<{
  avatar: AvatarDocument;
  spent: number;
  currencies: NonNullable<PlayerDocument['currencies']>;
}> {
  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar || readAvatarLifeStatus(avatar) !== 'failed' || !avatar.preDeathSnapshot) {
    throw new AvatarDeathError('Avatar is not awaiting sacrifice', 409, 'NOT_FAILED');
  }

  const cost = sacrificeCostForLevel(avatar.preDeathSnapshot.level);

  const result = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      throw new AvatarDeathError('Player not found', 404, 'PLAYER_NOT_FOUND');
    }

    const currentGems = readYellowRedGemBalance(player.currencies);
    if (currentGems < cost) {
      throw new InsufficientGemsForSacrificeError();
    }

    const snapshot = avatar.preDeathSnapshot!;
    const restoredAvatar: AvatarDocument = {
      ...avatar,
      status: 'active',
      level: snapshot.level,
      experience: snapshot.experience,
      inventory: snapshot.inventory,
      lastPlayedAt: snapshot.lastPlayedAt,
      progression: snapshot.progression,
      preDeathSnapshot: undefined,
    };

    await transaction.setInventory(playerId, avatarId, snapshot.inventory);
    await transaction.setProgression(playerId, avatarId, snapshot.progression);
    await transaction.setAvatar(playerId, avatarId, restoredAvatar, { merge: true });
    await transaction.setPlayer(
      playerId,
      {
        currencies: {
          ...(player.currencies ?? {}),
          yellow_red_gem: currentGems - cost,
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    return {
      avatar: restoredAvatar,
      spent: cost,
      currencies: {
        ...(player.currencies ?? {}),
        yellow_red_gem: currentGems - cost,
      },
    };
  });

  return result;
}

export async function finalizeAvatarDeath(
  playerId: string,
  avatarId: string,
): Promise<AvatarDocument> {
  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar || readAvatarLifeStatus(avatar) !== 'failed') {
    throw new AvatarDeathError('Avatar is not awaiting death finalization', 409, 'NOT_FAILED');
  }

  const inventory = avatar.inventory ?? await loadInventory(playerId, avatarId);
  const progression = await loadAvatarProgression(playerId, avatarId);
  const deceasedAvatar: AvatarDocument = {
    ...avatar,
    status: 'deceased',
    preDeathSnapshot: undefined,
    inventory,
    progression: (progression ?? avatar.progression ?? {}) as unknown as AvatarDocument['progression'],
  };

  await saveAvatar(playerId, avatarId, deceasedAvatar);
  await recordWallOfFameEntry(playerId, deceasedAvatar);
  await clearSoloCheckpointForAvatar(playerId, avatarId);

  return deceasedAvatar;
}

export async function readSacrificeGemCost(
  playerId: string,
  avatarId: string,
): Promise<number> {
  const avatar = await loadAvatar(playerId, avatarId);
  if (!avatar?.preDeathSnapshot) {
    return 0;
  }

  return sacrificeCostForLevel(avatar.preDeathSnapshot.level);
}
