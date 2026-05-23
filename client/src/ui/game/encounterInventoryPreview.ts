import solutionData from '../../data/game/solutiondata.json';
import type { AvatarInventory, InventoryItem } from '../../api/http.js';
import type { RollOutcome } from '@shared/diceInterpreter';
export { interpretRoll, isRollFavorable, type RollOutcome } from '@shared/diceInterpreter';

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionText?: string;
  mSolutionUses: number;
}

export interface EncounterInventoryChange {
  quantity: number;
  solution: SolutionRecord;
}

const solutionsById = solutionData as Record<string, SolutionRecord>;

export function scaledUses(baseUse: number, encounterDifficulty: number): number {
  if (encounterDifficulty < 1) {
    return 0;
  }

  return Math.max(1, baseUse * encounterDifficulty);
}

function inventoryItems(inventory: AvatarInventory | undefined): InventoryItem[] {
  if (!inventory) {
    return [];
  }

  return [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ].filter((item) => item.uses > 0);
}

function cloneInventory(inventory: AvatarInventory): AvatarInventory {
  return {
    spellbook: inventory.spellbook.map((item) => ({ ...item })),
    items: inventory.items.map((item) => ({ ...item })),
    essences: inventory.essences.map((item) => ({ ...item })),
  };
}

function firstBySolutionId(items: InventoryItem[]): InventoryItem | null {
  return [...items]
    .filter((item) => item.uses > 0)
    .sort((a, b) => a.solutionId - b.solutionId)[0] ?? null;
}

function consumeFromInventory(
  inventory: AvatarInventory,
  solutionId: number,
  amount: number,
): void {
  const containers = ['spellbook', 'items', 'essences'] as const;

  for (const container of containers) {
    const index = inventory[container].findIndex((item) => item.solutionId === solutionId);
    if (index === -1) {
      continue;
    }

    inventory[container][index].uses = Math.max(inventory[container][index].uses - amount, 0);
    if (inventory[container][index].uses <= 0) {
      inventory[container].splice(index, 1);
    }
    return;
  }
}

function consumeEssenceUse(inventory: AvatarInventory, amount: number): void {
  const essence = firstBySolutionId(inventory.essences);
  if (essence) {
    consumeFromInventory(inventory, essence.solutionId, amount);
  }
}

function toChange(item: InventoryItem, quantity: number): EncounterInventoryChange | null {
  const solution = solutionsById[String(item.solutionId)];
  if (!solution) {
    return null;
  }

  return { quantity, solution };
}

function pushLoss(
  losses: EncounterInventoryChange[],
  item: InventoryItem | null,
  quantity: number,
): void {
  if (!item || quantity <= 0) {
    return;
  }

  const change = toChange(item, quantity);
  if (!change) {
    return;
  }

  const existing = losses.find((loss) => loss.solution.mSolutionID === change.solution.mSolutionID);
  if (existing) {
    existing.quantity += change.quantity;
    return;
  }

  losses.push(change);
}

/**
 * Predict inventory losses shown on the result block (excludes the used encounter solution).
 */
export function predictEncounterLosses({
  encounterDifficulty,
  inventory,
  outcome,
  success,
  usedSolutionId,
}: {
  encounterDifficulty: number;
  inventory: AvatarInventory | undefined;
  outcome: RollOutcome | null;
  success: boolean;
  usedSolutionId: number | null;
}): EncounterInventoryChange[] {
  if (!inventory || success || !outcome) {
    return [];
  }

  const amount = scaledUses(1, encounterDifficulty);
  if (amount <= 0) {
    return [];
  }

  const working = cloneInventory(inventory);
  const losses: EncounterInventoryChange[] = [];

  if (usedSolutionId !== null) {
    const usedItem = inventoryItems(inventory).find((item) => item.solutionId === usedSolutionId);
    if (usedItem) {
      consumeFromInventory(working, usedSolutionId, amount);
    }
  }

  if (outcome === 'Hardship') {
    const essence = firstBySolutionId(working.essences);
    pushLoss(losses, essence, amount);
    consumeEssenceUse(working, amount);
  }

  if (outcome === 'Misery') {
    const essence = firstBySolutionId(working.essences);
    pushLoss(losses, essence, amount);
    consumeEssenceUse(working, amount);

    const item = firstBySolutionId(working.items);
    pushLoss(losses, item, amount);
  }

  if (usedSolutionId !== null) {
    return losses.filter((loss) => loss.solution.mSolutionID !== usedSolutionId);
  }

  return losses;
}

export function usedEncounterSolution({
  inventory,
  solutionId,
}: {
  inventory: AvatarInventory | undefined;
  solutionId: number | null;
}): EncounterInventoryChange | null {
  if (!inventory || solutionId === null) {
    return null;
  }

  const item = inventoryItems(inventory).find((entry) => entry.solutionId === solutionId);
  if (!item) {
    return null;
  }

  return toChange(item, item.uses);
}
