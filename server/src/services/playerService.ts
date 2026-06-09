import type { AvatarDocument } from '../types/avatar.js';
import { readAvatarLifeStatus } from './avatarDeathService.js';
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
  withDocumentTransaction,
} from '../db/postgresDocumentStore.js';
import { getExpansionById } from './gameData.js';
import { readAvatarDisplayTitle } from '../domain/achievements/achievementTitles.js';
import {
  recordAvatarCreatedEvent,
  recordGemsDonatedEvent,
  recordGemsReceivedEvent,
} from './gameEventService.js';

export class InsufficientGemsForDonationError extends Error {
  constructor() {
    super('Insufficient yellow red gems for donation');
    this.name = 'InsufficientGemsForDonationError';
  }
}

export class ExpansionNotFoundError extends Error {
  constructor() {
    super('Expansion not found');
    this.name = 'ExpansionNotFoundError';
  }
}

export class ExpansionInactiveError extends Error {
  constructor() {
    super('Expansion is not available');
    this.name = 'ExpansionInactiveError';
  }
}

export class ExpansionAlreadyUnlockedError extends Error {
  constructor() {
    super('Expansion already unlocked');
    this.name = 'ExpansionAlreadyUnlockedError';
  }
}

export class InsufficientGemsForExpansionError extends Error {
  constructor() {
    super('Insufficient yellow red gems for expansion unlock');
    this.name = 'InsufficientGemsForExpansionError';
  }
}

const DEFAULT_UNLOCKED_EXPANSIONS = [0];
export const BABUNI_PLAYER_ID = 'Babuni';
export const MAX_PLAYER_AVATARS = 3;

export class AvatarLimitReachedError extends Error {
  constructor() {
    super(`Players may have at most ${MAX_PLAYER_AVATARS} avatars`);
    this.name = 'AvatarLimitReachedError';
  }
}

export type AvatarRace = 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
export type AvatarRole = 'Mage' | 'Warrior' | 'Rogue';

export interface PersistedAvatarPayload {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  portrait: string;
  frame: string;
  createdAt?: number;
  lastPlayedAt?: number;
  displayTitle?: string | null;
}

export function uniqueSortedExpansionIds(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function readYellowRedGemBalance(
  currencies: PlayerDocument['currencies'] | undefined,
): number {
  const gems = currencies?.yellow_red_gem;

  if (typeof gems === 'number' && Number.isFinite(gems)) {
    return Math.max(0, Math.floor(gems));
  }

  if (typeof gems === 'string') {
    const parsed = Number(gems);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }

  return 0;
}

function uniqueSorted(values: number[]): number[] {
  return uniqueSortedExpansionIds(values);
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
    currencies: {
      ...(typeof data.currencies === 'object' && data.currencies !== null ? data.currencies : {}),
      yellow_red_gem: readYellowRedGemBalance(data.currencies),
    },
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
  const base = player?.unlockedExpansions && player.unlockedExpansions.length > 0
    ? player.unlockedExpansions
    : DEFAULT_UNLOCKED_EXPANSIONS;

  return base;
}

export async function addPlayerYellowRedGems(
  playerId: string,
  amount: number,
  loreGemClaimKey?: string,
): Promise<{ currencies: NonNullable<PlayerDocument['currencies']>; granted: boolean }> {
  if (amount > 0 && !loreGemClaimKey?.trim()) {
    throw new Error('loreGemClaimKey is required when granting yellow_red_gem');
  }

  const { currencies, granted } = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    const currentCurrencies = player?.currencies ?? {};
    const loreGemClaims = player?.loreGemClaims ?? {};
    const alreadyClaimed = loreGemClaimKey ? loreGemClaims[loreGemClaimKey] === true : false;
    const currentAmount = typeof currentCurrencies.yellow_red_gem === 'number'
      ? currentCurrencies.yellow_red_gem
      : 0;
    const nextCurrencies = {
      ...currentCurrencies,
      yellow_red_gem: currentAmount + (alreadyClaimed ? 0 : amount),
    };
    const grantedNow = !alreadyClaimed && amount > 0;

    await transaction.setPlayer(
      playerId,
      {
        currencies: nextCurrencies,
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

    return { currencies: nextCurrencies, granted: grantedNow };
  });

  if (granted) {
    await recordGemsReceivedEvent(playerId, amount, {
      encounterKey: loreGemClaimKey,
      source: loreGemClaimKey ? 'lore_gem' : 'general',
    });
  }

  return { currencies, granted };
}

export async function donatePlayerYellowRedGems(
  playerId: string,
  amount: number,
): Promise<{
  currencies: NonNullable<PlayerDocument['currencies']>;
  donated: number;
}> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid donation amount: ${amount}`);
  }

  const { currencies, donated } = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    const currentCurrencies = player?.currencies ?? {};
    const currentAmount = typeof currentCurrencies.yellow_red_gem === 'number'
      ? currentCurrencies.yellow_red_gem
      : 0;
    const donatedAmount = Math.min(amount, currentAmount);

    if (donatedAmount <= 0) {
      throw new InsufficientGemsForDonationError();
    }

    const nextCurrencies = {
      ...currentCurrencies,
      yellow_red_gem: currentAmount - donatedAmount,
    };

    await transaction.setPlayer(
      playerId,
      {
        currencies: nextCurrencies,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    return { currencies: nextCurrencies, donated: donatedAmount };
  });

  await recordGemsDonatedEvent(playerId, donated);

  return { currencies, donated };
}

export async function unlockPlayerExpansion(
  playerId: string,
  expansionId: number,
): Promise<{
  currencies: NonNullable<PlayerDocument['currencies']>;
  unlockedExpansions: number[];
  expansionId: number;
  spent: number;
}> {
  if (!Number.isInteger(expansionId) || expansionId <= 0) {
    throw new Error(`Invalid expansion id: ${expansionId}`);
  }

  const expansion = getExpansionById(expansionId);

  if (!expansion) {
    throw new ExpansionNotFoundError();
  }

  if (!expansion.mExtensioActive) {
    throw new ExpansionInactiveError();
  }

  const { currencies, nextUnlockedExpansions } = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const baseUnlocked = normalizeUnlockedExpansions(player.unlockedExpansions);
    const unlockedExpansions = baseUnlocked.length > 0 ? baseUnlocked : DEFAULT_UNLOCKED_EXPANSIONS;
    if (unlockedExpansions.includes(expansionId)) {
      throw new ExpansionAlreadyUnlockedError();
    }

    const cost = expansion.mExtensioCost;
    const currentCurrencies = player.currencies ?? {};
    const currentGems = typeof currentCurrencies.yellow_red_gem === 'number'
      ? currentCurrencies.yellow_red_gem
      : 0;
    if (currentGems < cost) {
      throw new InsufficientGemsForExpansionError();
    }

    const nextCurrencies = {
      ...currentCurrencies,
      yellow_red_gem: currentGems - cost,
    };
    const nextUnlocked = uniqueSorted([...baseUnlocked, expansionId]);

    await transaction.setPlayer(
      playerId,
      {
        currencies: nextCurrencies,
        unlockedExpansions: nextUnlocked,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    return { currencies: nextCurrencies, nextUnlockedExpansions: nextUnlocked };
  });

  return {
    currencies,
    unlockedExpansions: nextUnlockedExpansions,
    expansionId,
    spent: expansion.mExtensioCost,
  };
}

/**
 * Grant an expansion without spending gems (used by real-money purchases).
 * Idempotent: granting an already-unlocked expansion is a no-op.
 */
export async function grantPlayerExpansion(
  playerId: string,
  expansionId: number,
): Promise<{
  unlockedExpansions: number[];
  expansionId: number;
  alreadyUnlocked: boolean;
}> {
  if (!Number.isInteger(expansionId) || expansionId <= 0) {
    throw new Error(`Invalid expansion id: ${expansionId}`);
  }

  const expansion = getExpansionById(expansionId);

  if (!expansion) {
    throw new ExpansionNotFoundError();
  }

  return withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const baseUnlocked = normalizeUnlockedExpansions(player.unlockedExpansions);
    const unlockedExpansions = baseUnlocked.length > 0 ? baseUnlocked : DEFAULT_UNLOCKED_EXPANSIONS;

    if (unlockedExpansions.includes(expansionId)) {
      return { unlockedExpansions, expansionId, alreadyUnlocked: true };
    }

    const nextUnlocked = uniqueSorted([...unlockedExpansions, expansionId]);

    await transaction.setPlayer(
      playerId,
      {
        unlockedExpansions: nextUnlocked,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    return { unlockedExpansions: nextUnlocked, expansionId, alreadyUnlocked: false };
  });
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

  if (!existing) {
    const avatarCount = (await listAvatars<AvatarDocument>(playerId))
      .filter((entry) => {
        const status = readAvatarLifeStatus(entry.data);
        return status !== 'deceased' && status !== 'failed';
      })
      .length;
    if (avatarCount >= MAX_PLAYER_AVATARS) {
      throw new AvatarLimitReachedError();
    }
  }
  const profile: AvatarDocument['profile'] = {
    ...existing?.profile,
    raceRewardType: raceRewardType(payload.race),
    roleRewardType: roleRewardType(payload.role),
    displayTitle: Object.prototype.hasOwnProperty.call(payload, 'displayTitle')
      ? (typeof payload.displayTitle === 'string'
        ? payload.displayTitle.trim() || null
        : null)
      : readAvatarDisplayTitle(existing ?? {}),
  };
  const storedInventory = await loadInventory(playerId, payload.id);
  const inventory = existing?.inventory
    ?? storedInventory
    ?? createInitialAvatarInventory(profile);
  const avatar: AvatarDocument = {
    ...existing,
    id: payload.id,
    name: payload.name,
    race: payload.race,
    role: payload.role,
    level: typeof existing?.level === 'number' ? existing.level : 1,
    experience: typeof existing?.experience === 'number' ? existing.experience : 0,
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
      lastInteractionAt: Date.now(),
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

  return Promise.all(avatars.map(async (avatar) => {
    const avatarId = avatar.data.id ?? avatar.id;

    return {
      ...avatar.data,
      id: avatarId,
      inventory: avatar.data.inventory ?? await loadInventory(playerId, avatarId),
    };
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
