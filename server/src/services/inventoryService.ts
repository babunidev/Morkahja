import type {
  AvatarInventory,
  AvatarProfile,
  InventoryItem,
} from '../types/avatar.js';
import type { SolutionData } from '../engine/types.js';
import { getSolutionMap } from './gameData.js';
import { getInventory, setAvatar, setInventory } from '../db/postgresDocumentStore.js';

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

export async function resetInventory(
  playerId: string,
  avatarId: string,
): Promise<AvatarInventory> {
  const inventory = createEmptyInventory();
  await persistInventory(playerId, avatarId, inventory);
  return inventory;
}

function deterministicSolutions(
  predicate: (solution: SolutionData) => boolean,
  count: number,
): number[] {
  return Object.values(getSolutionMap())
    .filter(predicate)
    .sort((a, b) => a.mSolutionID - b.mSolutionID)
    .slice(0, count)
    .map((solution) => solution.mSolutionID);
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
  const next = normalizeInventory(inventory);
  const solution = getSolution(solutionId);
  const container = resolveInventoryContainer(solution.mSolutionInventoryType);
  const entries = next[container];
  const index = entries.findIndex((item) => item.solutionId === solutionId);

  if (index === -1) {
    throw new Error(`Solution ${solutionId} not found in ${container}`);
  }

  entries[index].uses = Math.max(entries[index].uses - amount, 0);

  if (entries[index].uses <= 0) {
    entries.splice(index, 1);
  }

  return next;
}

function consumeEssenceUseFromInventoryState(
  inventory: AvatarInventory,
  amount = 1,
): AvatarInventory {
  const essence = firstBySolutionId(inventory.essences);
  return essence
    ? consumeSolutionFromInventoryState(inventory, essence.solutionId, amount)
    : normalizeInventory(inventory);
}

function removeRandomItemFromInventoryState(
  inventory: AvatarInventory,
  amount = 1,
): AvatarInventory {
  const item = firstBySolutionId(inventory.items);
  return item
    ? consumeSolutionFromInventoryState(inventory, item.solutionId, amount)
    : normalizeInventory(inventory);
}

export function applyFailurePenaltyToInventoryState(
  inventory: AvatarInventory,
  outcome: InventoryPenaltyOutcome,
  encounterDifficulty = 1,
): AvatarInventory {
  const amount = scaledUses(1, encounterDifficulty);

  if (amount <= 0) {
    return normalizeInventory(inventory);
  }

  if (outcome === 'Hardship') {
    return consumeEssenceUseFromInventoryState(inventory, amount);
  }

  if (outcome === 'Misery') {
    return removeRandomItemFromInventoryState(
      consumeEssenceUseFromInventoryState(inventory, amount),
      amount,
    );
  }

  return normalizeInventory(inventory);
}

export function applyEncounterInventoryChanges(
  inventory: AvatarInventory,
  usedSolutionIds: number[],
  rewards: number[],
  success: boolean,
  selectedRollOutcome: InventoryPenaltyOutcome | null,
  encounterDifficulty: number,
): AvatarInventory {
  const amount = scaledUses(1, encounterDifficulty);
  let next = normalizeInventory(inventory);

  if (amount > 0) {
    for (const solutionId of usedSolutionIds) {
      next = consumeSolutionFromInventoryState(next, solutionId, amount);
    }
  }

  if (success) {
    for (const reward of rewards) {
      const solution = getSolution(reward);
      next = addRewardToInventoryState(
        next,
        reward,
        scaledUses(solution.mSolutionUses ?? 1, encounterDifficulty),
      );
    }
    return next;
  }

  return selectedRollOutcome
    ? applyFailurePenaltyToInventoryState(next, selectedRollOutcome, encounterDifficulty)
    : next;
}

export function createInitialAvatarInventory(profile: AvatarProfile): AvatarInventory {
  const roleRewardType = profile.roleRewardType ?? 37;
  const raceRewardType = profile.raceRewardType ?? 40;
  const seedIds = [
    ...deterministicSolutions(
      (solution) =>
        solution.mSolutionRewardType === roleRewardType &&
        solution.mSolutionInventoryType === 1,
      2,
    ),
    ...deterministicSolutions(
      (solution) =>
        solution.mSolutionRewardType === raceRewardType &&
        solution.mSolutionInventoryType === 1,
      3,
    ),
    ...deterministicSolutions(
      (solution) =>
        solution.mSolutionRewardType === 2 &&
        solution.mSolutionInventoryType === 2,
      5,
    ),
    ...deterministicSolutions(
      (solution) =>
        solution.mSolutionType === 15 &&
        solution.mSolutionInventoryType === 3,
      3,
    ),
  ];

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
  ].filter((item) => item.uses > 0).map((item) => item.solutionId);
}

export async function getInventorySolutionIds(
  playerId: string,
  avatarId: string,
): Promise<number[]> {
  return flattenInventorySolutionIds(await loadInventory(playerId, avatarId));
}

export async function addRewardToInventory(
  playerId: string,
  avatarId: string,
  solutionId: number,
  uses?: number,
): Promise<AvatarInventory> {
  const solution = getSolution(solutionId);
  const container = resolveInventoryContainer(solution.mSolutionInventoryType);
  const inventory = await loadInventory(playerId, avatarId);
  const existing = inventory[container].find(
    (item) => item.solutionId === solutionId,
  );

  if (existing) {
    existing.uses += Math.max(uses ?? solution.mSolutionUses ?? 1, 1);
  } else {
    inventory[container].push(createInventoryItem(solution, uses));
  }

  await persistInventory(playerId, avatarId, inventory);
  return inventory;
}

export async function consumeSolution(
  playerId: string,
  avatarId: string,
  solutionId: number,
  amount = 1,
): Promise<AvatarInventory> {
  const solution = getSolution(solutionId);
  const container = resolveInventoryContainer(solution.mSolutionInventoryType);
  const inventory = await loadInventory(playerId, avatarId);
  const entries = inventory[container];
  const index = entries.findIndex((item) => item.solutionId === solutionId);

  if (index === -1) {
    throw new Error(`Solution ${solutionId} not found in ${container}`);
  }

  entries[index].uses = Math.max(entries[index].uses - amount, 0);

  if (entries[index].uses <= 0) {
    entries.splice(index, 1);
  }

  await persistInventory(playerId, avatarId, inventory);
  return inventory;
}

export async function consumeSolutions(
  playerId: string,
  avatarId: string,
  solutionIds: number[],
  encounterDifficulty: number,
): Promise<void> {
  const amount = scaledUses(1, encounterDifficulty);

  if (amount <= 0) {
    return;
  }

  for (const solutionId of solutionIds) {
    await consumeSolution(playerId, avatarId, solutionId, amount);
  }
}

function firstBySolutionId(items: InventoryItem[]): InventoryItem | null {
  return [...items].filter((item) => item.uses > 0)
    .sort((a, b) => a.solutionId - b.solutionId)[0] ?? null;
}

export async function consumeEssenceUse(
  playerId: string,
  avatarId: string,
  amount = 1,
): Promise<AvatarInventory> {
  const inventory = await loadInventory(playerId, avatarId);
  const essence = firstBySolutionId(inventory.essences);

  if (!essence) {
    return inventory;
  }

  return consumeSolution(playerId, avatarId, essence.solutionId, amount);
}

export async function removeRandomItem(
  playerId: string,
  avatarId: string,
  amount = 1,
): Promise<AvatarInventory> {
  const inventory = await loadInventory(playerId, avatarId);
  const item = firstBySolutionId(inventory.items);

  if (!item) {
    return inventory;
  }

  return consumeSolution(playerId, avatarId, item.solutionId, amount);
}

export async function addRewardsToInventory(
  playerId: string,
  avatarId: string,
  solutionIds: number[],
): Promise<void> {
  for (const solutionId of solutionIds) {
    await addRewardToInventory(playerId, avatarId, solutionId);
  }
}

export async function applyFailurePenalty(
  playerId: string,
  avatarId: string,
  outcome: InventoryPenaltyOutcome,
  encounterDifficulty = 1,
): Promise<void> {
  const amount = scaledUses(1, encounterDifficulty);

  if (amount <= 0) {
    return;
  }

  if (outcome === 'Hardship') {
    await consumeEssenceUse(playerId, avatarId, amount);
  }

  if (outcome === 'Misery') {
    await consumeEssenceUse(playerId, avatarId, amount);
    await removeRandomItem(playerId, avatarId, amount);
  }
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
