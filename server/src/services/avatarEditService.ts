import {
  avatarEditCost,
  frameIdFromFile,
  normalizeAvatarName,
  PORTRAIT_RACE_IDS,
  PORTRAIT_ROLE_IDS,
  portraitIdFromFile,
} from '@shared/avatarEdit.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { readAvatarLifeStatus } from './avatarDeathService.js';
import { getFramesData, getPortraitsData, type FrameData, type PortraitData } from './gameData.js';
import { readYellowRedGemBalance } from './playerService.js';

export class AvatarEditRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface AvatarEditRequest {
  /** The new portrait's id, or the current one. */
  portraitId: number;
  /** The new frame's id, or the current one. */
  frameId: number;
  name: string;
}

function findPortrait(id: number | null): PortraitData | null {
  return id === null ? null : getPortraitsData().Avatar.find((entry) => entry?.avatarID === id) ?? null;
}

function findFrame(id: number | null): FrameData | null {
  return id === null ? null : getFramesData().Frames.find((entry) => entry?.frameID === id) ?? null;
}

/**
 * Edit an avatar's portrait, frame and name (D-056). The new portrait keeps
 * the avatar's race, role and gender. The server prices the change itself
 * from the game data, and the avatar and the player rows are locked in one
 * transaction, so the gems and the change go together.
 */
export async function editAvatarLook(
  playerId: string,
  avatarId: string,
  request: AvatarEditRequest,
): Promise<{ avatar: AvatarDocument; spent: number; currencies: PlayerDocument['currencies'] }> {
  const name = normalizeAvatarName(request.name);
  if (!name) {
    throw new AvatarEditRequestError('The avatar needs a name', 400, 'NAME_REQUIRED');
  }

  return withDocumentTransaction(async (transaction) => {
    // Avatar first, then player: the same lock order as an encounter's Continue.
    const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
    if (!avatar) {
      throw new AvatarEditRequestError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
    }
    if (readAvatarLifeStatus(avatar) !== 'active') {
      throw new AvatarEditRequestError('This avatar cannot be edited', 409, 'AVATAR_NOT_ACTIVE');
    }

    const currentPortrait = findPortrait(portraitIdFromFile(avatar.portrait));
    const nextPortrait = findPortrait(request.portraitId);
    if (!nextPortrait) {
      throw new AvatarEditRequestError('Unknown portrait', 400, 'UNKNOWN_PORTRAIT');
    }
    // Same race, role and gender as the current portrait; an avatar whose
    // portrait is not in the data keeps at least its own race and role.
    const keepsLook = currentPortrait
      ? nextPortrait.avatarRace === currentPortrait.avatarRace
        && nextPortrait.avatarRole === currentPortrait.avatarRole
        && nextPortrait.avatarGenderID === currentPortrait.avatarGenderID
      : nextPortrait.avatarRace === PORTRAIT_RACE_IDS[avatar.race ?? '']
        && nextPortrait.avatarRole === PORTRAIT_ROLE_IDS[avatar.role ?? ''];
    if (!keepsLook) {
      throw new AvatarEditRequestError('The portrait must keep the race, role and gender', 400, 'PORTRAIT_MISMATCH');
    }
    const nextFrame = findFrame(request.frameId);
    if (!nextFrame) {
      throw new AvatarEditRequestError('Unknown frame', 400, 'UNKNOWN_FRAME');
    }

    const portraitChanged = nextPortrait.avatarID !== currentPortrait?.avatarID;
    const frameChanged = nextFrame.frameID !== frameIdFromFile(avatar.frame);
    const nameChanged = name !== (avatar.name?.trim() ?? '');
    const cost = avatarEditCost({
      portraitGems: portraitChanged ? nextPortrait.avatarGems : null,
      frameGems: frameChanged ? nextFrame.frameGem : null,
      nameChanged,
    });

    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      throw new AvatarEditRequestError('Player not found', 404, 'PLAYER_NOT_FOUND');
    }
    const currencies = player.currencies ?? {};
    if (!portraitChanged && !frameChanged && !nameChanged) {
      return { avatar, spent: 0, currencies };
    }
    const gems = readYellowRedGemBalance(currencies);
    if (gems < cost) {
      throw new AvatarEditRequestError('Not enough gems for this change', 409, 'INSUFFICIENT_GEMS');
    }

    const nextCurrencies = cost > 0 ? { ...currencies, yellow_red_gem: gems - cost } : currencies;
    if (cost > 0) {
      await transaction.setPlayer(playerId, { currencies: nextCurrencies, updatedAt: Date.now() }, { merge: true });
    }
    const changes = {
      portrait: `avatar_${nextPortrait.avatarID}.webp`,
      frame: `frame_${nextFrame.frameID}.webp`,
      name,
    };
    await transaction.setAvatar(playerId, avatarId, changes as never, { merge: true });
    return { avatar: { ...avatar, ...changes }, spent: cost, currencies: nextCurrencies };
  });
}
