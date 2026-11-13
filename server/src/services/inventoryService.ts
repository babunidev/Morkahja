import { randomInt as cryptoRandomInt } from 'node:crypto';
import type {
  AvatarInventory,
  AvatarProfile,
  InventoryItem,
} from '../types/avatar.js';
import type { SolutionData } from '../engine/types.js';
import { getSolutionMap } from './gameData.js';
import { getInventory, setAvatar, setInventory } from '../db/postgresDocumentStore.js';

export const WARRIOR_IMPROVISED_WEAPON_ID = 10062;
const WARRIOR_ROLE_REWARD_TYPE = 38;

export type RandomIntFn = (min: number, max: number) => number;

function defaultRandomInt(min: number, max: number): number {
  return min + cryptoRandomInt(max - min + 1);
}

export type InventoryContainerName = 'spellbook' | 'items' | 'essences';
export type InventoryPenaltyOutcome =
  | 'Misery'
  | 'Hardship'
  | 'Disengage'
  | 'Fortune'
  | 'Prosperity';

export function resolveInventoryContainer(
  solutionInventoryType: number,
): InventoryContainerName {
  switch (solutionInventoryType) {
    case 1:
      return 'spellbook';
    case 2:
      return 'items';
    case 3:
      return 'essences';
    default:
      throw new Error(
        `Invalid mSolutionInventoryType for inventory routing: ${solutionInventoryType}`,
      );
  }
}

export function createEmptyInventory(): AvatarInventory {
  return {
    spellbook: [],
    items: [],
    essences: [],
  };
}

function normalizeInventory(value: Partial<AvatarInventory> | undefined): AvatarInventory {
  return {
    spellbook: (value?.spellbook ?? []).map((item) => ({ ...item })),
    items: (value?.items ?? []).map((item) => ({ ...item })),
    essences: (value?.essences ?? []).map((item) => ({ ...item })),
  };
}

function getSolution(solutionId: number): SolutionData {
  const solution = getSolutionMap()[String(solutionId)];

  if (!solution) {
    throw new Error(`Solution not found: ${solutionId}`);
  }

  return solution;
}

function createInventoryItem(solution: SolutionData, uses?: number): InventoryItem {
  return {
    solutionId: solution.mSolutionID,
    solutionType: solution.mSolutionType,
    uses: Math.max(uses ?? solution.mSolutionUses ?? 1, 1),
  };
}

export function scaledUses(baseUse: number, encounterDifficulty: number): number {
  if (encounterDifficulty < 1) {
    return 0;
  }

  return Math.max(1, baseUse * encounterDifficulty);
}

export async function persistInventory(
  playerId: string,
  avatarId: string,
  inventory: AvatarInventory,
): Promise<void> {
  await setInventory(playerId, avatarId, inventory);
  await setAvatar(playerId, avatarId, { inventory }, { merge: true });
}

export async function loadInventory(
  playerId: string,
  avatarId: string,
): Promise<AvatarInventory> {
  const inventory = await getInventory<Partial<AvatarInventory>>(playerId, avatarId);

  if (!inventory) {
    return createEmptyInventory();
  }

  return normalizeInventory(inventory);
}

export async function inventoryExists(
  playerId: string,
  avatarId: string,
): Promise<boolean> {
  return (await getInventory(playerId, avatarId)) !== null;
}

function isWarriorProfile(profile: AvatarProfile): boolean {
  return profile.roleRewardType === WARRIOR_ROLE_REWARD_TYPE;
}

/** Inclusive [min, max] integer sampler for starter-pack randomization. */
export function randomSampleSolutionIds(
  predicate: (solution: SolutionData) => boolean,
  count: number,
  options: {
    randomInt?: RandomIntFn;
    reservedIds?: number[];
  } = {},
): number[] {
  const randomInt = options.randomInt ?? defaultRandomInt;
  const reservedIds = options.reservedIds ?? [];
  const pool = Object.values(getSolutionMap())
    .filter(predicate)
    .sort((left, right) => left.mSolutionID - right.mSolutionID);
  const picks: number[] = [];

  for (const solutionId of reservedIds) {
    if (picks.length >= count) {
      break;
    }

    if (pool.some((solution) => solution.mSolutionID === solutionId)) {
      picks.push(solutionId);
    }
  }

  const available = pool.filter((solution) => !picks.includes(solution.mSolutionID));

  while (picks.length < count && available.length > 0) {
    const index = randomInt(0, available.length - 1);
    const [picked] = available.splice(index, 1);
    picks.push(picked.mSolutionID);
  }

  return picks;
}

export function buildInitialAvatarSeedIds(
  profile: AvatarProfile,
  options: { randomInt?: RandomIntFn } = {},
): number[] {
  const roleRewardType = profile.roleRewardType ?? 37;
  const raceRewardType = profile.raceRewardType ?? 40;
  const roleSpellbookIds = randomSampleSolutionIds(
    (solution) =>
      solution.mSolutionRewardType === roleRewardType &&
      solution.mSolutionInventoryType === 1,
    2,
    options,
  );
  const raceSpellbookIds = randomSampleSolutionIds(
    (solution) =>
      solution.mSolutionRewardType === raceRewardType &&
      solution.mSolutionInventoryType === 1,
    3,
    options,
  );
  const itemIds = randomSampleSolutionIds(
    (solution) =>
      solution.mSolutionRewardType === 2 &&
      solution.mSolutionInventoryType === 2,
    5,
    options,
  );
  const essenceIds = randomSampleSolutionIds(
    (solution) =>
      solution.mSolutionType === 15 &&
      solution.mSolutionInventoryType === 3,
    3,
    options,
  );
  const seedIds = [
    ...roleSpellbookIds,
    ...raceSpellbookIds,
    ...itemIds,
    ...essenceIds,
  ];

  if (isWarriorProfile(profile) && !seedIds.includes(WARRIOR_IMPROVISED_WEAPON_ID)) {
    seedIds.push(WARRIOR_IMPROVISED_WEAPON_ID);
  }

  return seedIds;
}

export function addRewardToInventoryState(
  inventory: AvatarInventory,
  solutionId: number,
  uses?: number,
): AvatarInventory {
  const next = normalizeInventory(inventory);
  const solution = getSolution(solutionId);
  const container = resolveInventoryContainer(solution.mSolutionInventoryType);
  const existing = next[container].find((item) => item.solutionId === solutionId);

  if (existing) {
    existing.uses += Math.max(uses ?? solution.mSolutionUses ?? 1, 1);
  } else {
    next[container].push(createInventoryItem(solution, uses));
  }

  return next;
}

export function consumeSolutionFromInventoryState(
  inventory: AvatarInventory,
  solutionId: number,
  amount = 1,
): AvatarInventory {
  let next = normalizeInventory(inventory);
  const solution = getSolution(solutionId);
  const container = resolveInventoryContainer(solution.mSolutionInventoryType);

  for (let chargeIndex = 0; chargeIndex < amount; chargeIndex += 1) {
    const entries = next[container];
    const index = entries.findIndex((item) => item.solutionId === solutionId && item.uses > 0);

    if (index === -1) {
      throw new Error(
        `Solution ${solutionId} is missing ${amount - chargeIndex} charge(s) in ${container}`,
      );
    }

    entries[index].uses -= 1;

    if (entries[index].uses <= 0) {
      entries.splice(index, 1);
    }
  }

  return next;
}

/** Solution type of a real essence (a life). */
export const ESSENCE_SOLUTION_TYPE = 15;

/**
 * Only real essences are lost on Hardship or Misery. The essences container
 * also holds the Atranor items (solution type 77), which are used in Atranor
 * to revive or secure the passage, never lost as lives (Babuni, 2026-11-13).
 */
const isEssence = (item: InventoryItem): boolean => item.solutionType === ESSENCE_SOLUTION_TYPE;

function flattenContainerChargeSolutionIds(
  inventory: AvatarInventory,
  container: InventoryContainerName,
  include: (item: InventoryItem) => boolean = () => true,
): number[] {
  return inventory[container].flatMap((item) =>
    item.uses > 0 && include(item) ? Array.from({ length: item.uses }, () => item.solutionId) : [],
  );
}

function consumeRandomChargesFromContainerState(
  inventory: AvatarInventory,
  container: InventoryContainerName,
  amount: number,
  randomInt: RandomIntFn = defaultRandomInt,
  include?: (item: InventoryItem) => boolean,
): { inventory: AvatarInventory; lostSolutionIds: number[] } {
  let next = normalizeInventory(inventory);
  const lostSolutionIds: number[] = [];

  for (let index = 0; index < amount; index += 1) {
    const charges = flattenContainerChargeSolutionIds(next, container, include);
    if (charges.length === 0) {
      break;
    }

    const pickIndex = randomInt(0, charges.length - 1);
    const solutionId = charges[pickIndex]!;
    lostSolutionIds.push(solutionId);
    next = consumeSolutionFromInventoryState(next, solutionId, 1);
  }

  return { inventory: next, lostSolutionIds };
}

export interface FailurePenaltyApplyResult {
  inventory: AvatarInventory;
  lostSolutionIds: number[];
}

export function applyFailurePenaltyToInventoryState(
  inventory: AvatarInventory,
  outcome: InventoryPenaltyOutcome,
  encounterDifficulty = 1,
  options: { randomInt?: RandomIntFn } = {},
): FailurePenaltyApplyResult {
  const randomInt = options.randomInt ?? defaultRandomInt;
  const amount = scaledUses(1, encounterDifficulty);

  if (amount <= 0) {
    return { inventory: normalizeInventory(inventory), lostSolutionIds: [] };
  }

  if (outcome === 'Hardship') {
    return consumeRandomChargesFromContainerState(
      inventory,
      'essences',
      amount,
      randomInt,
      isEssence,
    );
  }

  if (outcome === 'Misery') {
    const essenceLoss = consumeRandomChargesFromContainerState(
      inventory,
      'essences',
      amount,
      randomInt,
      isEssence,
    );
    const itemLoss = consumeRandomChargesFromContainerState(
      essenceLoss.inventory,
      'items',
      amount,
      randomInt,
    );

    return {
      inventory: itemLoss.inventory,
      lostSolutionIds: [...essenceLoss.lostSolutionIds, ...itemLoss.lostSolutionIds],
    };
  }

  return { inventory: normalizeInventory(inventory), lostSolutionIds: [] };
}

export interface EncounterInventoryApplyResult {
  inventory: AvatarInventory;
  lostInventorySolutions: number[];
}

export function applyEncounterInventoryChanges(
  inventory: AvatarInventory,
  usedSolutionIds: number[],
  rewards: number[],
  success: boolean,
  selectedRollOutcome: InventoryPenaltyOutcome | null,
  encounterDifficulty: number,
  rewardAmount: number,
  options: { randomInt?: RandomIntFn } = {},
): EncounterInventoryApplyResult {
  let next = normalizeInventory(inventory);

  for (const solutionId of usedSolutionIds) {
    next = consumeSolutionFromInventoryState(next, solutionId, 1);
  }

  if (success) {
    for (const reward of rewards) {
      const solution = getSolution(reward);
      next = addRewardToInventoryState(
        next,
        reward,
        Math.max(1, solution.mSolutionUses ?? 1),
      );
    }
    return { inventory: next, lostInventorySolutions: [] };
  }

  if (!selectedRollOutcome) {
    return { inventory: next, lostInventorySolutions: [] };
  }

  const penalty = applyFailurePenaltyToInventoryState(
    next,
    selectedRollOutcome,
    encounterDifficulty,
    options,
  );

  return {
    inventory: penalty.inventory,
    lostInventorySolutions: penalty.lostSolutionIds,
  };
}

export function createInitialAvatarInventory(
  profile: AvatarProfile,
  options: { randomInt?: RandomIntFn } = {},
): AvatarInventory {
  const seedIds = buildInitialAvatarSeedIds(profile, options);

  return seedIds.reduce(
    (inventory, solutionId) => addRewardToInventoryState(inventory, solutionId),
    createEmptyInventory(),
  );
}

export function flattenInventorySolutionIds(inventory: AvatarInventory): number[] {
  return [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ].flatMap((item) => {
    if (item.uses <= 0) {
      return [];
    }

    return Array.from({ length: item.uses }, () => item.solutionId);
  });
}

export async function initializeAvatarInventory(
  playerId: string,
  avatarId: string,
  profile: AvatarProfile,
): Promise<AvatarInventory> {
  const inventory = createInitialAvatarInventory(profile);
  await persistInventory(playerId, avatarId, inventory);
  return inventory;
}
