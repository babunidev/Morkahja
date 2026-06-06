import solutionData from '../../data/game/solutiondata.json';
import type { AvatarInventory, EncounterAction, InventoryItem } from '../../api/http.js';
import type { RollOutcome } from '@shared/diceInterpreter';
export { interpretRoll, isRollFavorable, type RollOutcome } from '@shared/diceInterpreter';

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionText?: string;
  mSolutionType: number;
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

function flattenSolutionUses(items: InventoryItem[]): number[] {
  const flat: number[] = [];

  for (const item of items) {
    for (let index = 0; index < item.uses; index += 1) {
      flat.push(item.solutionId);
    }
  }

  return flat;
}

function totalPrimarySolutionUses(items: InventoryItem[], primaryId: number): number {
  return items
    .filter((item) => item.solutionId === primaryId)
    .reduce((total, item) => total + item.uses, 0);
}

function totalSecondaryTypeUses(items: InventoryItem[], secondaryType: number): number {
  return items
    .filter((item) => item.solutionType === secondaryType)
    .reduce((total, item) => total + item.uses, 0);
}

function primaryRequirementForSlot(
  encounter: {
    primarySolutionA?: number;
    primarySolutionB?: number;
    primarySolutionC?: number;
    primarySolutionD?: number;
  },
  slot: EncounterAction,
): number {
  switch (slot) {
    case 'A':
      return encounter.primarySolutionA ?? 0;
    case 'B':
      return encounter.primarySolutionB ?? 0;
    case 'C':
      return encounter.primarySolutionC ?? 0;
    case 'D':
      return encounter.primarySolutionD ?? 0;
    default:
      return 0;
  }
}

function secondaryRequirementForSlot(
  encounter: {
    secondarySolutionTypeA?: number;
    secondarySolutionTypeB?: number;
    secondarySolutionTypeC?: number;
    secondarySolutionTypeD?: number;
  },
  slot: EncounterAction,
): number {
  switch (slot) {
    case 'A':
      return encounter.secondarySolutionTypeA ?? 0;
    case 'B':
      return encounter.secondarySolutionTypeB ?? 0;
    case 'C':
      return encounter.secondarySolutionTypeC ?? 0;
    case 'D':
      return encounter.secondarySolutionTypeD ?? 0;
    default:
      return 0;
  }
}

function pickUsedSolutionIdsForPrimary(
  inventory: number[],
  primarySolutionId: number,
  requiredUses: number,
): number[] {
  const matches = inventory.filter((solutionId) => solutionId === primarySolutionId);

  if (matches.length < requiredUses) {
    return [];
  }

  return matches.slice(0, requiredUses);
}

function pickUsedSolutionIdsForSecondary(
  inventory: number[],
  requiredType: number,
  requiredUses: number,
): number[] {
  const matches = inventory
    .filter((solutionId) => solutionsById[String(solutionId)]?.mSolutionType === requiredType)
    .sort((left, right) => left - right);

  if (matches.length < requiredUses) {
    return [];
  }

  return matches.slice(0, requiredUses);
}

export function slotHasEnoughSolutionCharges({
  encounter,
  inventory,
  slot,
}: {
  encounter: {
    encounterDifficulty?: number;
    primarySolutionA?: number;
    primarySolutionB?: number;
    primarySolutionC?: number;
    primarySolutionD?: number;
    secondarySolutionTypeA?: number;
    secondarySolutionTypeB?: number;
    secondarySolutionTypeC?: number;
    secondarySolutionTypeD?: number;
  };
  inventory: AvatarInventory | undefined;
  slot: EncounterAction;
}): { available: boolean; isPrimary: boolean; requiredUses: number; totalUses: number } {
  if (slot === 'dice') {
    return { available: false, isPrimary: false, requiredUses: 0, totalUses: 0 };
  }

  const items = inventoryItems(inventory);
  const requiredUses = scaledUses(1, encounter.encounterDifficulty ?? 1);
  const primaryId = primaryRequirementForSlot(encounter, slot);
  const secondaryType = secondaryRequirementForSlot(encounter, slot);
  const primaryTotal = primaryId > 0 ? totalPrimarySolutionUses(items, primaryId) : 0;
  const secondaryTotal = secondaryType > 0 ? totalSecondaryTypeUses(items, secondaryType) : 0;

  if (primaryId > 0 && primaryTotal >= requiredUses) {
    return { available: true, isPrimary: true, requiredUses, totalUses: primaryTotal };
  }

  if (secondaryType > 0 && secondaryTotal >= requiredUses) {
    return { available: true, isPrimary: false, requiredUses, totalUses: secondaryTotal };
  }

  const previewTotal = primaryId > 0 ? primaryTotal : secondaryTotal;
  return {
    available: false,
    isPrimary: primaryId > 0,
    requiredUses,
    totalUses: previewTotal,
  };
}

export function predictUsedSolutionIds({
  encounter,
  inventory,
  action,
}: {
  encounter: {
    encounterDifficulty?: number;
    primarySolutionA?: number;
    primarySolutionB?: number;
    primarySolutionC?: number;
    primarySolutionD?: number;
    secondarySolutionTypeA?: number;
    secondarySolutionTypeB?: number;
    secondarySolutionTypeC?: number;
    secondarySolutionTypeD?: number;
  };
  inventory: AvatarInventory | undefined;
  action: EncounterAction | null;
}): number[] {
  if (!inventory || !action || action === 'dice') {
    return [];
  }

  const requiredUses = scaledUses(1, encounter.encounterDifficulty ?? 1);
  const flatInventory = flattenSolutionUses(inventoryItems(inventory));
  const primaryId = primaryRequirementForSlot(encounter, action);
  const secondaryType = secondaryRequirementForSlot(encounter, action);
  const primaryUsed = primaryId > 0
    ? pickUsedSolutionIdsForPrimary(flatInventory, primaryId, requiredUses)
    : [];

  if (primaryUsed.length >= requiredUses) {
    return primaryUsed;
  }

  return secondaryType > 0
    ? pickUsedSolutionIdsForSecondary(flatInventory, secondaryType, requiredUses)
    : [];
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
  usedSolutionIds,
}: {
  encounterDifficulty: number;
  inventory: AvatarInventory | undefined;
  outcome: RollOutcome | null;
  success: boolean;
  usedSolutionIds: number[];
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
  const usedSolutionIdSet = new Set(usedSolutionIds);

  for (const solutionId of usedSolutionIds) {
    consumeFromInventory(working, solutionId, 1);
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

  if (usedSolutionIdSet.size > 0) {
    return losses.filter((loss) => !usedSolutionIdSet.has(loss.solution.mSolutionID));
  }

  return losses;
}

function usedSolutionChanges(
  inventory: AvatarInventory,
  usedSolutionIds: number[],
): EncounterInventoryChange[] {
  const counts = new Map<number, number>();

  for (const solutionId of usedSolutionIds) {
    counts.set(solutionId, (counts.get(solutionId) ?? 0) + 1);
  }

  const changes: EncounterInventoryChange[] = [];

  for (const [solutionId, quantity] of counts) {
    const item = inventoryItems(inventory).find((entry) => entry.solutionId === solutionId);
    const change = toChange(
      item ?? { solutionId, solutionType: solutionsById[String(solutionId)]?.mSolutionType ?? 0, uses: quantity },
      quantity,
    );

    if (change) {
      changes.push(change);
    }
  }

  return changes.sort(
    (left, right) => left.solution.mSolutionID - right.solution.mSolutionID,
  );
}

export function usedEncounterSolutions({
  inventory,
  usedSolutionIds,
}: {
  inventory: AvatarInventory | undefined;
  usedSolutionIds: number[];
}): EncounterInventoryChange[] {
  if (!inventory || usedSolutionIds.length === 0) {
    return [];
  }

  return usedSolutionChanges(inventory, usedSolutionIds);
}

/** @deprecated Use usedEncounterSolutions for multi-stack consumption. */
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

  const changes = usedEncounterSolutions({ inventory, usedSolutionIds: [solutionId] });
  return changes[0] ?? null;
}
