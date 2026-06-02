import {
  findPlayerByNameOrId,
  getPlayer,
  setPlayer,
} from '../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../types/player.js';
import {
  addPlayerFriend,
  CannotAddSelfError,
  FriendAlreadyAddedError,
  FriendLookupNotFoundError,
  getPlayerFriendIds,
  type FriendSummary,
} from './friendService.js';

export class SoulLinkAlreadySetError extends Error {
  constructor() {
    super('Soul link has already been chosen');
    this.name = 'SoulLinkAlreadySetError';
  }
}

export class SoulLinkTargetNotFoundError extends Error {
  constructor() {
    super('Player not found');
    this.name = 'SoulLinkTargetNotFoundError';
  }
}

export class CannotSoulLinkSelfError extends Error {
  constructor() {
    super('Cannot soul link to yourself');
    this.name = 'CannotSoulLinkSelfError';
  }
}

export interface SoulLinkView {
  targetId: string;
  targetName: string;
  linkedAt: number;
}

function toSoulLinkView(soulLink: NonNullable<PlayerDocument['soulLink']>): SoulLinkView {
  return {
    targetId: soulLink.targetId,
    targetName: soulLink.targetName,
    linkedAt: soulLink.linkedAt,
  };
}

export async function getSoulLink(playerId: string): Promise<SoulLinkView | null> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const soulLink = player?.soulLink;

  if (!soulLink || typeof soulLink.targetId !== 'string') {
    return null;
  }

  return toSoulLinkView(soulLink as NonNullable<PlayerDocument['soulLink']>);
}

export async function createSoulLink(
  playerId: string,
  query: string,
): Promise<{ soulLink: SoulLinkView; friend: FriendSummary | null; friendIds: string[] }> {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new SoulLinkTargetNotFoundError();
  }

  const viewer = await getPlayer<Partial<PlayerDocument>>(playerId);

  if (viewer?.soulLink && typeof viewer.soulLink.targetId === 'string') {
    throw new SoulLinkAlreadySetError();
  }

  const viewerName = typeof viewer?.playerName === 'string' ? viewer.playerName : playerId;
  const match = await findPlayerByNameOrId<Partial<PlayerDocument>>(trimmed);

  if (!match) {
    throw new SoulLinkTargetNotFoundError();
  }

  const targetId = match.id;
  const targetName = typeof match.data.playerName === 'string' ? match.data.playerName : targetId;
  const normalizedQuery = trimmed.toLowerCase();

  const isSelf = targetId === playerId
    || normalizedQuery === playerId.toLowerCase()
    || (viewerName.trim().length > 0 && normalizedQuery === viewerName.trim().toLowerCase());

  if (isSelf) {
    throw new CannotSoulLinkSelfError();
  }

  const linkedAt = Date.now();

  await setPlayer(
    playerId,
    {
      soulLink: {
        targetId,
        targetName,
        linkedAt,
      },
      updatedAt: linkedAt,
    },
    { merge: true },
  );

  let friend: FriendSummary | null = null;
  let friendIds: string[];

  try {
    const result = await addPlayerFriend(playerId, trimmed);
    friend = result.friend;
    friendIds = result.friendIds;
  } catch (error) {
    if (
      error instanceof FriendAlreadyAddedError
      || error instanceof CannotAddSelfError
      || error instanceof FriendLookupNotFoundError
    ) {
      friendIds = await getPlayerFriendIds(playerId);
    } else {
      throw error;
    }
  }

  return {
    soulLink: { targetId, targetName, linkedAt },
    friend,
    friendIds,
  };
}
