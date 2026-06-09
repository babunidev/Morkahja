import type { AvatarDocument } from '../types/avatar.js';
import { readAvatarLifeStatus } from './avatarDeathService.js';
import type { DiceId } from '@shared/diceCatalog.js';
import { readPlayerDiceState } from './diceService.js';
import type { PlayerDocument, WallOfFameEntry } from '../types/player.js';
import {
  collectUnlockedTitlesFromAchievements,
  readAvatarDisplayTitle,
  type UnlockedTitleOption,
} from '../domain/achievements/achievementTitles.js';
import { loadAchievementTitleSourcesForPlayer } from '../domain/achievements/achievementTitleSources.js';
import { getPlayer, listAvatars, setPlayer } from '../db/postgresDocumentStore.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';
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
  displayTitle: string | null;
  status?: AvatarDocument['status'];
}

export interface PlayerProfile {
  playerId: string;
  playerName: string;
  joinedAt: number;
  avatars: PlayerProfileAvatarView[];
  wallOfFame: WallOfFameEntry[];
  unlockedTitles: UnlockedTitleOption[];
  unlockedDiceIds: DiceId[];
  selectedDiceId: DiceId;
}

export class InvalidAvatarDisplayTitleError extends Error {
  constructor() {
    super('Achievement title is not unlocked');
    this.name = 'InvalidAvatarDisplayTitleError';
  }
}

export class AvatarProfileNotFoundError extends Error {
  constructor() {
    super('Avatar not found');
    this.name = 'AvatarProfileNotFoundError';
  }
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
    .sort((left, right) => right.diedAt - left.diedAt)
    .filter((entry, index, entries) => (
      entries.findIndex((candidate) => candidate.id === entry.id) === index
    ));
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
    displayTitle: readAvatarDisplayTitle(avatar),
    status: readAvatarLifeStatus(avatar),
  };
}

export async function listUnlockedAchievementTitles(
  playerId: string,
): Promise<UnlockedTitleOption[]> {
  const achievements = await loadAchievementTitleSourcesForPlayer(playerId);
  return collectUnlockedTitlesFromAchievements(achievements);
}

export async function setAvatarDisplayTitle(
  playerId: string,
  avatarId: string,
  displayTitle: string | null,
): Promise<AvatarDocument> {
  const avatar = await loadAvatar(playerId, avatarId);

  if (!avatar) {
    throw new AvatarProfileNotFoundError();
  }

  const normalized = typeof displayTitle === 'string' && displayTitle.trim().length > 0
    ? displayTitle.trim()
    : null;

  if (normalized !== null) {
    const unlockedTitles = await listUnlockedAchievementTitles(playerId);
    const isUnlocked = unlockedTitles.some((entry) => entry.title === normalized);

    if (!isUnlocked) {
      throw new InvalidAvatarDisplayTitleError();
    }
  }

  const nextAvatar: AvatarDocument = {
    ...avatar,
    profile: {
      ...avatar.profile,
      displayTitle: normalized,
    },
  };

  await saveAvatar(playerId, avatarId, nextAvatar);
  return nextAvatar;
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

  const [avatarRecords, unlockedTitles, dice] = await Promise.all([
    listAvatars<AvatarDocument>(playerId).then((records) => (
      records.map((record) => ({
        ...record.data,
        id: record.data.id ?? record.id,
      }))
        .map(toProfileAvatarView)
        .filter((avatar): avatar is PlayerProfileAvatarView => avatar !== null)
    )),
    listUnlockedAchievementTitles(playerId),
    readPlayerDiceState(playerId),
  ]);

  const livingAvatars = avatarRecords
    .filter((avatar) => avatar.status !== 'deceased' && avatar.status !== 'failed')
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(0, 3);

  return {
    playerId,
    playerName: player.playerName,
    joinedAt: player.createdAt,
    avatars: livingAvatars,
    wallOfFame: player.wallOfFame,
    unlockedTitles,
    unlockedDiceIds: dice.unlockedDiceIds,
    selectedDiceId: dice.selectedDiceId,
  };
}
