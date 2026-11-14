import { gameSolutions } from '../../data/gameContent.js';
import type { AvatarInventory, EncounterAction, InventoryItem } from '../../api/http.js';
export { interpretRoll, isRollFavorable, type RollOutcome } from '@shared/diceInterpreter';
import {
  allocateSolutionSet,
  slotFaces,
  solutionSetSize,
  type SolutionSetPickAllocation,
  type SolutionSetRequirements,
  type SolutionSetSlot,
  type SolutionSlotFace,
} from '@shared/solutionSet';

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

function solutionsById(): Record<string, SolutionRecord> {
  return gameSolutions() as Record<string, SolutionRecord>;
}

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

type SlotRequirementFields = {
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

function solutionSetRequirements(encounter: SlotRequirementFields): SolutionSetRequirements {
  const requirement = (slot: SolutionSetSlot) => ({
    primarySolutionId: primaryRequirementForSlot(encounter, slot),
    secondarySolutionType: secondaryRequirementForSlot(encounter, slot),
  });
  return { A: requirement('A'), B: requirement('B'), C: requirement('C'), D: requirement('D') };
}

function catalogSolutionType(solutionId: number): number | undefined {
  return solutionsById()[String(solutionId)]?.mSolutionType;
}

/** The item placed in one slot: the same item a tap of that slot spends. */
export function faceForSlot({
  encounter,
  inventory,
  slot,
}: {
  encounter: SlotRequirementFields;
  inventory: AvatarInventory | undefined;
  slot: EncounterAction;
}): SolutionSlotFace | null {
  if (slot === 'dice') {
    return null;
  }
  return slotFaces(
    solutionSetRequirements(encounter),
    flattenSolutionUses(inventoryItems(inventory)),
    catalogSolutionType,
  )[slot] ?? null;
}

/** The server's allocation of inventory charges to a solution set, or null if it cannot be covered. */
export function allocateSolutionSetPicks({
  encounter,
  inventory,
  picks,
}: {
  encounter: SlotRequirementFields;
  inventory: AvatarInventory | undefined;
  picks: readonly SolutionSetSlot[];
}): SolutionSetPickAllocation[] | null {
  return allocateSolutionSet(
    picks,
    solutionSetRequirements(encounter),
    flattenSolutionUses(inventoryItems(inventory)),
    (solutionId) => solutionsById()[String(solutionId)]?.mSolutionType,
  );
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
}): {
  available: boolean;
  isPrimary: boolean;
  requiredUses: number;
  solutionId?: number;
  totalUses: number;
} {
  if (slot === 'dice') {
    return { available: false, isPrimary: false, requiredUses: 0, totalUses: 0 };
  }

  const items = inventoryItems(inventory);
  const requiredUses = solutionSetSize(encounter.encounterDifficulty);
  const primaryId = primaryRequirementForSlot(encounter, slot);
  const face = faceForSlot({ encounter, inventory, slot });

  if (face) {
    const totalUses = items
      .filter((item) => item.solutionId === face.solutionId)
      .reduce((total, item) => total + item.uses, 0);
    return {
      available: true,
      isPrimary: face.lane === 'primary',
      requiredUses,
      solutionId: face.solutionId,
      totalUses,
    };
  }

  const previewTotal = primaryId > 0
    ? items.filter((item) => item.solutionId === primaryId).reduce((total, item) => total + item.uses, 0)
    : 0;
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
  picks,
}: {
  encounter: SlotRequirementFields;
  inventory: AvatarInventory | undefined;
  action: EncounterAction | null;
  /** The committed solution set; without it, the action's slot as many times as needed. */
  picks?: readonly SolutionSetSlot[] | null;
}): number[] {
  if (!inventory || !action || action === 'dice') {
    return [];
  }

  const setPicks = picks ?? Array.from(
    { length: solutionSetSize(encounter.encounterDifficulty) },
    () => action,
  );
  const allocation = allocateSolutionSetPicks({ encounter, inventory, picks: setPicks });
  return allocation ? allocation.map((pick) => pick.solutionId) : [];
}

function inventoryChangesFromSolutionIds(
  inventory: AvatarInventory | undefined,
  solutionIds: number[],
): EncounterInventoryChange[] {
  if (!inventory || solutionIds.length === 0) {
    return [];
  }

  const counts = new Map<number, number>();

  for (const solutionId of solutionIds) {
    counts.set(solutionId, (counts.get(solutionId) ?? 0) + 1);
  }

  const changes: EncounterInventoryChange[] = [];

  for (const [solutionId, quantity] of counts) {
    const item = inventoryItems(inventory).find((entry) => entry.solutionId === solutionId);
    const change = toChange(
      item ?? {
        solutionId,
        solutionType: solutionsById()[String(solutionId)]?.mSolutionType ?? 0,
        uses: quantity,
      },
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

export function encounterLossesFromSolutionIds({
  inventory,
  lostSolutionIds,
  usedSolutionIds = [],
}: {
  inventory: AvatarInventory | undefined;
  lostSolutionIds: number[];
  usedSolutionIds?: number[];
}): EncounterInventoryChange[] {
  const usedSolutionIdSet = new Set(usedSolutionIds);
  const filtered = lostSolutionIds.filter((solutionId) => !usedSolutionIdSet.has(solutionId));
  return inventoryChangesFromSolutionIds(inventory, filtered);
}

function toChange(item: InventoryItem, quantity: number): EncounterInventoryChange | null {
  const solution = solutionsById()[String(item.solutionId)];
  if (!solution) {
    return null;
  }

  return { quantity, solution };
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
      item ?? { solutionId, solutionType: solutionsById()[String(solutionId)]?.mSolutionType ?? 0, uses: quantity },
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
