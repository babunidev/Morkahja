import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument, WallOfFameEntry } from '../types/player.js';
import { getPlayer, listAvatars, setPlayer } from '../db/postgresDocumentStore.js';
import { loadAvatarProgression } from './avatarProgressionService.js';
import type { AvatarRace, AvatarRole } from './playerService.js';

const MAX_WALL_OF_FAME_ENTRIES = 48;

export interface PlayerProfileAvatarView {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  portrait: string;
  frame: string;
  createdAt: number;
}

export interface PlayerProfile {
  playerId: string;
  playerName: string;
  joinedAt: number;
  avatars: PlayerProfileAvatarView[];
  wallOfFame: WallOfFameEntry[];
}

function normalizeWallOfFame(value: unknown): WallOfFameEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is WallOfFameEntry => (
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as WallOfFameEntry).id === 'string'
      && typeof (entry as WallOfFameEntry).name === 'string'
      && typeof (entry as WallOfFameEntry).race === 'string'
      && typeof (entry as WallOfFameEntry).role === 'string'
      && typeof (entry as WallOfFameEntry).level === 'number'
      && typeof (entry as WallOfFameEntry).portrait === 'string'
      && typeof (entry as WallOfFameEntry).frame === 'string'
      && typeof (entry as WallOfFameEntry).encountersPlayed === 'number'
      && typeof (entry as WallOfFameEntry).diedAt === 'number'
    ))
    .sort((left, right) => right.diedAt - left.diedAt);
}

function toProfileAvatarView(avatar: AvatarDocument): PlayerProfileAvatarView | null {
  if (!avatar.id || !avatar.portrait || !avatar.frame || !avatar.race || !avatar.role) {
    return null;
  }

  const createdAt = typeof avatar.createdAt === 'number' ? avatar.createdAt : 0;

  return {
    id: avatar.id,
    name: avatar.name?.trim() || 'Adventurer',
    race: avatar.race,
    role: avatar.role,
    level: typeof avatar.level === 'number' ? avatar.level : 1,
    portrait: avatar.portrait,
    frame: avatar.frame,
    createdAt,
  };
}

export async function recordWallOfFameEntry(
  playerId: string,
  avatar: AvatarDocument,
): Promise<void> {
  const avatarId = avatar.id;

  if (!avatarId || !avatar.portrait || !avatar.frame || !avatar.race || !avatar.role) {
    return;
  }

  const progression = await loadAvatarProgression(playerId, avatarId);
  const entry: WallOfFameEntry = {
    id: avatarId,
    name: avatar.name?.trim() || 'Adventurer',
    race: avatar.race,
    role: avatar.role,
    level: typeof avatar.level === 'number' ? avatar.level : progression.level,
    portrait: avatar.portrait,
    frame: avatar.frame,
    encountersPlayed: progression.encountersCompleted,
    diedAt: Date.now(),
  };

  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const existing = normalizeWallOfFame(player?.wallOfFame);
  const withoutDuplicate = existing.filter((current) => current.id !== entry.id);
  const next = [entry, ...withoutDuplicate].slice(0, MAX_WALL_OF_FAME_ENTRIES);

  await setPlayer(
    playerId,
    {
      wallOfFame: next,
      updatedAt: Date.now(),
    } satisfies Partial<PlayerDocument>,
    { merge: true },
  );
}

async function readPlayerSummary(playerId: string): Promise<{
  playerName: string;
  createdAt: number;
  wallOfFame: WallOfFameEntry[];
} | null> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);

  if (!player) {
    return null;
  }

  const now = Date.now();

  return {
    playerName: typeof player.playerName === 'string' ? player.playerName : playerId,
    createdAt: typeof player.createdAt === 'number' ? player.createdAt : now,
    wallOfFame: normalizeWallOfFame(player.wallOfFame),
  };
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  const player = await readPlayerSummary(playerId);

  if (!player) {
    return null;
  }

  const avatars = (await listAvatars<AvatarDocument>(playerId))
    .map((record) => ({
      ...record.data,
      id: record.data.id ?? record.id,
    }))
    .map(toProfileAvatarView)
    .filter((avatar): avatar is PlayerProfileAvatarView => avatar !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(0, 3);

  return {
    playerId,
    playerName: player.playerName,
    joinedAt: player.createdAt,
    avatars,
    wallOfFame: player.wallOfFame,
  };
}
