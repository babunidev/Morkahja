import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';
import {
  createInitialAvatarInventory,
  initializeAvatarInventory,
  loadInventory,
} from './inventoryService.js';
import {
  deleteActiveEncounter,
  deleteAvatar,
  deleteInventory,
  deleteProgression,
  getPlayer,
  listAvatars,
  setPlayer,
} from '../db/postgresDocumentStore.js';
import { recordAvatarCreatedEvent, recordGemsReceivedEvent } from './gameEventService.js';

const DEFAULT_UNLOCKED_EXPANSIONS = [0];
export const BABUNI_PLAYER_ID = 'Babuni';

export type AvatarRace = 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
export type AvatarRole = 'Mage' | 'Warrior' | 'Rogue';

export interface PersistedAvatarPayload {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  experience: number;
  inventory?: unknown;
  portrait: string;
  frame: string;
  createdAt?: number;
  lastPlayedAt?: number;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function normalizeUnlockedExpansions(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(
    value.filter((entry): entry is number => Number.isInteger(entry)),
  );
}

export async function loadPlayer(
  playerId: string,
): Promise<PlayerDocument | null> {
  const data = await getPlayer<Partial<PlayerDocument>>(playerId);

  if (!data) {
    return null;
  }

  const now = Date.now();

  return {
    ...data,
    playerId: typeof data.playerId === 'string' ? data.playerId : playerId,
    playerName: typeof data.playerName === 'string' ? data.playerName : playerId,
    identityPublicKey: typeof data.identityPublicKey === 'string' ? data.identityPublicKey : '',
    activeSessionId: typeof data.activeSessionId === 'string' ? data.activeSessionId : null,
    activeSessionExpiresAt: typeof data.activeSessionExpiresAt === 'number' ? data.activeSessionExpiresAt : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : now,
    lastPlayedAt: typeof data.lastPlayedAt === 'number' ? data.lastPlayedAt : now,
    unlockedExpansions: normalizeUnlockedExpansions(data.unlockedExpansions),
  };
}

export async function ensurePlayerUnlockedExpansions(
  playerId: string,
  unlockedExpansions = DEFAULT_UNLOCKED_EXPANSIONS,
): Promise<number[]> {
  const player = await loadPlayer(playerId);
  const merged = uniqueSorted([
    ...(player?.unlockedExpansions ?? []),
    ...unlockedExpansions,
  ]);

  await setPlayer(
    playerId,
    {
      unlockedExpansions: merged.length > 0 ? merged : DEFAULT_UNLOCKED_EXPANSIONS,
    },
    { merge: true },
  );

  return merged.length > 0 ? merged : DEFAULT_UNLOCKED_EXPANSIONS;
}

export async function getPlayerUnlockedExpansions(
  playerId: string,
): Promise<number[]> {
  const player = await loadPlayer(playerId);
  return player?.unlockedExpansions && player.unlockedExpansions.length > 0
    ? player.unlockedExpansions
    : DEFAULT_UNLOCKED_EXPANSIONS;
}

export async function addPlayerYellowRedGems(
  playerId: string,
  amount: number,
  loreGemClaimKey?: string,
): Promise<{ currencies: NonNullable<PlayerDocument['currencies']>; granted: boolean }> {
  const player = await loadPlayer(playerId);
  const currentCurrencies = player?.currencies ?? {};
  const loreGemClaims = player?.loreGemClaims ?? {};
  const alreadyClaimed = loreGemClaimKey ? loreGemClaims[loreGemClaimKey] === true : false;
  const currentAmount = typeof currentCurrencies.yellow_red_gem === 'number'
    ? currentCurrencies.yellow_red_gem
    : 0;
  const currencies = {
    ...currentCurrencies,
    yellow_red_gem: currentAmount + (alreadyClaimed ? 0 : amount),
  };

  const granted = !alreadyClaimed && amount > 0;

  await setPlayer(
    playerId,
    {
      currencies,
      ...(loreGemClaimKey ? {
        loreGemClaims: {
          ...loreGemClaims,
          [loreGemClaimKey]: true,
        },
      } : {}),
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  if (granted) {
    await recordGemsReceivedEvent(playerId, amount, {
      encounterKey: loreGemClaimKey,
      source: loreGemClaimKey ? 'lore_gem' : 'general',
    });
  }

  return { currencies, granted };
}

export async function migrateAvatarUnlockedExpansionsToPlayer(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  void playerId;
  void avatarId;
  void avatar;
}

function roleRewardType(role: AvatarRole): 37 | 38 | 39 {
  switch (role) {
    case 'Mage':
      return 37;
    case 'Warrior':
      return 38;
    case 'Rogue':
      return 39;
  }
}

function raceRewardType(race: AvatarRace): 40 | 41 | 42 | 43 {
  switch (race) {
    case 'Rokur':
      return 40;
    case 'Verdani':
      return 41;
    case 'Aevis':
      return 42;
    case 'Grimnir':
      return 43;
  }
}

export async function saveBabuniAvatar(
  payload: PersistedAvatarPayload,
): Promise<AvatarDocument> {
  return savePlayerAvatar(BABUNI_PLAYER_ID, payload);
}

export async function savePlayerAvatar(
  playerId: string,
  payload: PersistedAvatarPayload,
): Promise<AvatarDocument> {
  const now = Date.now();
  const existing = await loadAvatar(playerId, payload.id);
  const profile: AvatarDocument['profile'] = {
    ...existing?.profile,
    raceRewardType: raceRewardType(payload.race),
    roleRewardType: roleRewardType(payload.role),
  };
  const inventory = (payload.inventory as AvatarDocument['inventory'] | undefined)
    ?? existing?.inventory
    ?? createInitialAvatarInventory(profile);
  const avatar: AvatarDocument = {
    ...existing,
    id: payload.id,
    name: payload.name,
    race: payload.race,
    role: payload.role,
    level: payload.level,
    experience: payload.experience,
    portrait: payload.portrait,
    frame: payload.frame,
    createdAt: payload.createdAt ?? existing?.createdAt ?? now,
    lastPlayedAt: now,
    profile,
    progression: existing?.progression ?? {},
    activeEncounter: existing?.activeEncounter ?? null,
  };

  if (inventory) {
    avatar.inventory = inventory;
  }

  await ensurePlayerUnlockedExpansions(playerId);
  await saveAvatar(playerId, payload.id, avatar);
  if (!existing) {
    await initializeAvatarInventory(playerId, payload.id, avatar.profile);
    await recordAvatarCreatedEvent(playerId, avatar);
  }
  return avatar;
}

export async function selectBabuniAvatar(
  payload: PersistedAvatarPayload,
): Promise<AvatarDocument> {
  return selectPlayerAvatar(BABUNI_PLAYER_ID, payload);
}

export async function selectPlayerAvatar(
  playerId: string,
  payload: PersistedAvatarPayload,
): Promise<AvatarDocument> {
  const avatar = await savePlayerAvatar(playerId, payload);

  await setPlayer(
    playerId,
    {
      activeAvatarId: payload.id,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return avatar;
}

export async function loadBabuniAvatars(): Promise<AvatarDocument[]> {
  return loadPlayerAvatars(BABUNI_PLAYER_ID);
}

export async function loadPlayerAvatars(playerId: string): Promise<AvatarDocument[]> {
  const avatars = await listAvatars<AvatarDocument>(playerId);

  return avatars.map((avatar) => ({
    ...avatar.data,
    id: avatar.data.id ?? avatar.id,
  }));
}

export async function loadBabuniActiveAvatar(): Promise<AvatarDocument | null> {
  return loadPlayerActiveAvatar(BABUNI_PLAYER_ID);
}

export async function loadPlayerActiveAvatar(playerId: string): Promise<AvatarDocument | null> {
  const player = await loadPlayer(playerId);
  const activeAvatarId = player?.activeAvatarId;

  if (typeof activeAvatarId !== 'string') {
    return null;
  }

  const avatar = await loadAvatar(playerId, activeAvatarId);

  if (!avatar) {
    return null;
  }

  return {
    ...avatar,
    id: avatar.id ?? activeAvatarId,
    inventory: avatar.inventory ?? await loadInventory(playerId, activeAvatarId),
  };
}

export async function deleteBabuniAvatar(avatarId: string): Promise<void> {
  await deletePlayerAvatar(BABUNI_PLAYER_ID, avatarId);
}

export async function deletePlayerAvatar(playerId: string, avatarId: string): Promise<void> {
  await deleteActiveEncounter(playerId, avatarId);
  await deleteInventory(playerId, avatarId);
  await deleteProgression(playerId, avatarId);
  await deleteAvatar(playerId, avatarId);
  await setPlayer(
    playerId,
    {
      activeAvatarId: null,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
