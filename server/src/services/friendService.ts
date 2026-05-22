import { findPlayerByNameOrId, getPlayer, setPlayer } from '../db/postgresDocumentStore.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';
import { getAchievementsSnapshotReadOnly } from './achievementService.js';
import { loadPlayerAvatars } from './playerService.js';

export class FriendNotFoundError extends Error {
  constructor() {
    super('Friend not found');
    this.name = 'FriendNotFoundError';
  }
}

export class FriendLookupNotFoundError extends Error {
  constructor() {
    super('Player not found');
    this.name = 'FriendLookupNotFoundError';
  }
}

export class CannotAddSelfError extends Error {
  constructor() {
    super('Cannot add yourself as a friend');
    this.name = 'CannotAddSelfError';
  }
}

export class FriendAlreadyAddedError extends Error {
  constructor() {
    super('Player is already on your friend list');
    this.name = 'FriendAlreadyAddedError';
  }
}

export class FriendAccessDeniedError extends Error {
  constructor() {
    super('Player is not on your friend list');
    this.name = 'FriendAccessDeniedError';
  }
}

export interface FriendSummary {
  playerId: string;
  playerName: string;
  online: boolean;
  portrait: string;
  frame: string;
  avatarName: string | null;
}

export interface FriendAvatarView {
  id: string;
  name: string;
  race: NonNullable<AvatarDocument['race']>;
  role: NonNullable<AvatarDocument['role']>;
  level: number;
  portrait: string;
  frame: string;
  lastPlayedAt: number;
  lastPlayed: boolean;
}

function uniqueFriendIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0),
  )];
}

function friendIdMatchesPlayer(playerId: string, friendId: string): boolean {
  return friendId.trim().toLowerCase() === playerId.trim().toLowerCase();
}

/** Drop self entries and persist when the stored list was dirty. */
async function sanitizeStoredFriendIds(playerId: string): Promise<string[]> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const stored = uniqueFriendIds(player?.friendIds);
  const sanitized = stored.filter((friendId) => !friendIdMatchesPlayer(playerId, friendId));

  if (sanitized.length !== stored.length) {
    await setPlayer(
      playerId,
      {
        friendIds: sanitized,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }

  return sanitized;
}

function isPlayerOnline(player: PlayerDocument): boolean {
  return typeof player.activeSessionExpiresAt === 'number'
    && player.activeSessionExpiresAt > Date.now();
}

function avatarLastPlayedTimestamp(avatar: AvatarDocument): number {
  return avatar.lastPlayedAt ?? avatar.createdAt ?? 0;
}

function isSelfFriendTarget(
  viewerId: string,
  viewerName: string,
  targetId: string,
  targetName: string,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedViewerName = viewerName.trim().toLowerCase();
  const normalizedTargetName = targetName.trim().toLowerCase();

  return (
    targetId === viewerId
    || normalizedQuery === viewerId.toLowerCase()
    || (normalizedViewerName.length > 0 && normalizedQuery === normalizedViewerName)
    || (normalizedViewerName.length > 0 && normalizedTargetName === normalizedViewerName && targetId === viewerId)
  );
}

function toFriendAvatarViews(avatars: AvatarDocument[]): FriendAvatarView[] {
  const lastPlayed = pickLastPlayedAvatar(avatars);
  const lastPlayedAt = lastPlayed ? avatarLastPlayedTimestamp(lastPlayed) : -1;

  return avatars
    .filter((avatar): avatar is AvatarDocument & {
      portrait: string;
      frame: string;
      race: NonNullable<AvatarDocument['race']>;
      role: NonNullable<AvatarDocument['role']>;
    } => Boolean(avatar.portrait && avatar.frame && avatar.race && avatar.role))
    .map((avatar) => {
      const playedAt = avatarLastPlayedTimestamp(avatar);

      return {
        id: avatar.id ?? '',
        name: avatar.name?.trim() || 'Adventurer',
        race: avatar.race,
        role: avatar.role,
        level: typeof avatar.level === 'number' ? avatar.level : 1,
        portrait: avatar.portrait,
        frame: avatar.frame,
        lastPlayedAt: playedAt,
        lastPlayed: lastPlayed !== null && playedAt === lastPlayedAt,
      };
    })
    .sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);
}

function pickLastPlayedAvatar(avatars: AvatarDocument[]): AvatarDocument | null {
  const playable = avatars.filter((avatar) => avatar.portrait && avatar.frame);

  if (playable.length === 0) {
    return null;
  }

  return playable.reduce((latest, candidate) => (
    avatarLastPlayedTimestamp(candidate) > avatarLastPlayedTimestamp(latest)
      ? candidate
      : latest
  ));
}

async function resolveFriendAvatar(
  playerId: string,
): Promise<Pick<FriendSummary, 'portrait' | 'frame' | 'avatarName'>> {
  const avatars = await loadPlayerAvatars(playerId);
  const lastPlayed = pickLastPlayedAvatar(avatars);

  if (lastPlayed?.portrait && lastPlayed.frame) {
    return {
      portrait: lastPlayed.portrait,
      frame: lastPlayed.frame,
      avatarName: lastPlayed.name ?? null,
    };
  }

  return {
    portrait: 'avatar_verdani_female_mage_a.webp',
    frame: 'frame_1.webp',
    avatarName: null,
  };
}

async function buildFriendSummary(
  friendId: string,
): Promise<FriendSummary | null> {
  const record = await getPlayer<Partial<PlayerDocument>>(friendId);

  if (!record) {
    return null;
  }

  const player = {
    ...record,
    playerId: typeof record.playerId === 'string' ? record.playerId : friendId,
    playerName: typeof record.playerName === 'string' ? record.playerName : friendId,
  } as PlayerDocument;
  const avatar = await resolveFriendAvatar(friendId);

  return {
    playerId: friendId,
    playerName: player.playerName,
    online: isPlayerOnline(player),
    ...avatar,
  };
}

export async function getPlayerFriendIds(playerId: string): Promise<string[]> {
  return sanitizeStoredFriendIds(playerId);
}

export async function listPlayerFriends(playerId: string): Promise<FriendSummary[]> {
  const viewer = await getPlayer<Partial<PlayerDocument>>(playerId);
  const viewerName = typeof viewer?.playerName === 'string' ? viewer.playerName : playerId;
  const friendIds = await getPlayerFriendIds(playerId);
  const summaries = await Promise.all(friendIds.map((friendId) => buildFriendSummary(friendId)));

  return summaries
    .filter((entry): entry is FriendSummary => entry !== null)
    .filter((entry) => !isSelfFriendTarget(
      playerId,
      viewerName,
      entry.playerId,
      entry.playerName,
      entry.playerId,
    ))
    .sort((left, right) => {
      if (left.online !== right.online) {
        return left.online ? -1 : 1;
      }

      return left.playerName.localeCompare(right.playerName, undefined, { sensitivity: 'base' });
    });
}

export async function addPlayerFriend(
  playerId: string,
  query: string,
): Promise<{ friend: FriendSummary; friendIds: string[] }> {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new FriendLookupNotFoundError();
  }

  const viewer = await getPlayer<Partial<PlayerDocument>>(playerId);
  const viewerName = typeof viewer?.playerName === 'string' ? viewer.playerName : playerId;

  const match = await findPlayerByNameOrId<Partial<PlayerDocument>>(trimmed);

  if (!match) {
    throw new FriendLookupNotFoundError();
  }

  const friendId = match.id;
  const friendName = typeof match.data.playerName === 'string' ? match.data.playerName : friendId;

  if (isSelfFriendTarget(playerId, viewerName, friendId, friendName, trimmed)) {
    throw new CannotAddSelfError();
  }

  const currentFriendIds = await sanitizeStoredFriendIds(playerId);

  if (currentFriendIds.includes(friendId)) {
    throw new FriendAlreadyAddedError();
  }

  const friendIds = [...currentFriendIds, friendId];

  await setPlayer(
    playerId,
    {
      friendIds,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  const friend = await buildFriendSummary(friendId);

  if (!friend) {
    throw new FriendLookupNotFoundError();
  }

  return { friend, friendIds };
}

export async function assertPlayerFriendship(
  playerId: string,
  friendId: string,
): Promise<void> {
  const friendIds = await getPlayerFriendIds(playerId);

  if (!friendIds.includes(friendId)) {
    throw new FriendAccessDeniedError();
  }
}

export async function getFriendAchievements(
  playerId: string,
  friendId: string,
) {
  if (friendId === playerId) {
    throw new FriendAccessDeniedError();
  }

  await assertPlayerFriendship(playerId, friendId);

  const friend = await getPlayer<Partial<PlayerDocument>>(friendId);

  if (!friend) {
    throw new FriendNotFoundError();
  }

  const player = {
    ...friend,
    playerId: typeof friend.playerId === 'string' ? friend.playerId : friendId,
    playerName: typeof friend.playerName === 'string' ? friend.playerName : friendId,
  } as PlayerDocument;
  const avatars = await loadPlayerAvatars(friendId);
  const avatarViews = toFriendAvatarViews(avatars);
  const lastPlayed = pickLastPlayedAvatar(avatars);
  const achievements = await getAchievementsSnapshotReadOnly(friendId);

  return {
    playerId: friendId,
    playerName: player.playerName,
    online: isPlayerOnline(player),
    portrait: lastPlayed?.portrait ?? avatarViews[0]?.portrait ?? 'avatar_verdani_female_mage_a.webp',
    frame: lastPlayed?.frame ?? avatarViews[0]?.frame ?? 'frame_1.webp',
    avatarName: lastPlayed?.name ?? avatarViews[0]?.name ?? null,
    avatars: avatarViews,
    achievements,
  };
}
