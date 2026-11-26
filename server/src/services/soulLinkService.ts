import {
  findPlayerByNameOrId,
  getPlayer,
  listSoulLinkers,
  setPlayer,
} from '../db/postgresDocumentStore.js';
import {
  SOUL_LINK_GIFT_ENCOUNTERS_REQUIRED,
  tryDeliverSoulLinkGift,
} from '../domain/achievements/soulLinkGift.js';
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
  giftDeliveredAt?: number;
  welcomeGift?: 'aetherion' | 'owned';
  /** Encounters the linked-to adventurer played today (UTC). */
  targetEncountersToday?: number;
}

/** An adventurer whose soul is linked to the viewer (D-068). */
export interface LinkedSoulView {
  playerId: string;
  playerName: string;
  linkedAt: number;
  giftDeliveredAt?: number;
  encountersToday: number;
}

export interface SoulLinkStatusView {
  soulLink: SoulLinkView | null;
  linkedSouls: LinkedSoulView[];
  encountersToday: number;
  encountersRequired: number;
}

function utcDayKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function encountersToday(player: Partial<PlayerDocument> | null | undefined, utcDay: string): number {
  const state = player?.dailyReward;
  return state && state.utcDay === utcDay ? Math.max(0, state.encountersPlayed ?? 0) : 0;
}

function toSoulLinkView(soulLink: NonNullable<PlayerDocument['soulLink']>): SoulLinkView {
  return {
    targetId: soulLink.targetId,
    targetName: soulLink.targetName,
    linkedAt: soulLink.linkedAt,
    ...(typeof soulLink.giftDeliveredAt === 'number' ? { giftDeliveredAt: soulLink.giftDeliveredAt } : {}),
    ...(soulLink.welcomeGift ? { welcomeGift: soulLink.welcomeGift } : {}),
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

/** The Soul Link window: the viewer's own link, today's encounters, and who linked to them. */
export async function getSoulLinkStatus(playerId: string, timestamp = Date.now()): Promise<SoulLinkStatusView> {
  const utcDay = utcDayKey(timestamp);
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const ownLink = player?.soulLink;
  let soulLink: SoulLinkView | null = null;

  if (ownLink && typeof ownLink.targetId === 'string') {
    soulLink = toSoulLinkView(ownLink as NonNullable<PlayerDocument['soulLink']>);
    if (soulLink.giftDeliveredAt === undefined) {
      const target = await getPlayer<Partial<PlayerDocument>>(ownLink.targetId);
      soulLink.targetEncountersToday = encountersToday(target, utcDay);
    }
  }

  const linkers = await listSoulLinkers<Partial<PlayerDocument>>(playerId);
  const linkedSouls = linkers.map(({ id, data }): LinkedSoulView => ({
    playerId: id,
    playerName: typeof data.playerName === 'string' && data.playerName.trim() ? data.playerName : id,
    linkedAt: typeof data.soulLink?.linkedAt === 'number' ? data.soulLink.linkedAt : 0,
    ...(typeof data.soulLink?.giftDeliveredAt === 'number' ? { giftDeliveredAt: data.soulLink.giftDeliveredAt } : {}),
    encountersToday: encountersToday(data, utcDay),
  }));

  return {
    soulLink,
    linkedSouls,
    encountersToday: encountersToday(player, utcDay),
    encountersRequired: SOUL_LINK_GIFT_ENCOUNTERS_REQUIRED,
  };
}

/** For the invite landing (D-068): the inviter's adventurer name, or null. */
export async function getSoulLinkInviterName(inviterId: string): Promise<string | null> {
  const trimmed = inviterId.trim();
  if (!trimmed || trimmed.length > 128) {
    return null;
  }
  const player = await getPlayer<Partial<PlayerDocument>>(trimmed);
  const name = player?.playerName?.trim();
  return name ? name : null;
}

export async function createSoulLink(
  playerId: string,
  query: string,
  options: { invite?: boolean } = {},
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

  // A link made from a QR invite connects both ways: the inviter sees the newcomer too.
  if (options.invite) {
    try {
      await addPlayerFriend(targetId, playerId);
    } catch (error) {
      if (!(error instanceof FriendAlreadyAddedError || error instanceof CannotAddSelfError)) {
        console.error('Soul link invite: could not add the newcomer as a friend', error);
      }
    }
  }

  // Both may already have played 42 encounters today.
  try {
    await tryDeliverSoulLinkGift(playerId, linkedAt);
  } catch (error) {
    console.error('Soul link gift delivery failed', error);
  }

  return {
    soulLink: { targetId, targetName, linkedAt },
    friend,
    friendIds,
  };
}
