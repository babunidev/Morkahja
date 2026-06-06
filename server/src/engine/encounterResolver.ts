import { randomInt as cryptoRandomInt } from 'node:crypto';
import { interpretRoll, isRollFavorable } from './diceInterpreter.js';
import {
  ENCOUNTER_SLOTS,
  EncounterData,
  EncounterSlotLetter,
  EntityId,
  SolutionData,
  SolutionDataMap,
  encounterDifficultyLossMultiplier,
} from './types.js';

/**
 * Immutable precomputed rolls assigned at encounter creation.
 * Each slot has a primary and secondary lane roll; rollA-D are legacy aliases.
 */
export interface EncounterRollSnapshot {
  readonly rollA: number;
  readonly rollB: number;
  readonly rollC: number;
  readonly rollD: number;
  readonly rollPrimaryA: number;
  readonly rollPrimaryB: number;
  readonly rollPrimaryC: number;
  readonly rollPrimaryD: number;
  readonly rollSecondaryA: number;
  readonly rollSecondaryB: number;
  readonly rollSecondaryC: number;
  readonly rollSecondaryD: number;
  readonly rollE: number;
}

export type SelectedEncounterAction =
  | { mode: 'dice' }
  | { mode: 'slot'; slot: EncounterSlotLetter };

export interface EncounterSlotResults {
  A: boolean;
  B: boolean;
  C: boolean;
  D: boolean;
}

export interface EncounterResolution {
  encounterId: number;
  success: boolean;
  selectedRoll: number;
  slotResults: EncounterSlotResults;
  usedInventorySolutions: number[];
  failurePenalty: number;
  rewards: number[];
  message: string;
}

interface SlotRequirement {
  primarySolutionId: EntityId;
  secondarySolutionType: number;
}

type SlotRequirementMap = Record<EncounterSlotLetter, SlotRequirement>;

interface SlotEvaluation {
  satisfied: boolean;
  inventoryValid: boolean;
  lane: 'primary' | 'secondary' | null;
  roll: number | null;
  usedSolutionIds: EntityId[];
}

export function createEncounterRollSnapshot(
  rolls: EncounterRollSnapshot,
): EncounterRollSnapshot {
  return Object.freeze({
    rollA: rolls.rollA,
    rollB: rolls.rollB,
    rollC: rolls.rollC,
    rollD: rolls.rollD,
    rollPrimaryA: rolls.rollPrimaryA,
    rollPrimaryB: rolls.rollPrimaryB,
    rollPrimaryC: rolls.rollPrimaryC,
    rollPrimaryD: rolls.rollPrimaryD,
    rollSecondaryA: rolls.rollSecondaryA,
    rollSecondaryB: rolls.rollSecondaryB,
    rollSecondaryC: rolls.rollSecondaryC,
    rollSecondaryD: rolls.rollSecondaryD,
    rollE: rolls.rollE,
  });
}

function buildSlotRequirements(encounter: EncounterData): SlotRequirementMap {
  return {
    A: {
      primarySolutionId: encounter.mEncounterSolutiuonA,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeA,
    },
    B: {
      primarySolutionId: encounter.mEncounterSolutiuonB,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeB,
    },
    C: {
      primarySolutionId: encounter.mEncounterSolutiuonC,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeC,
    },
    D: {
      primarySolutionId: encounter.mEncounterSolutiuonD,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeD,
    },
  };
}

function isSlotRequired(
  requirement: SlotRequirement,
): boolean {
  return requirement.primarySolutionId !== 0 || requirement.secondarySolutionType !== 0;
}

function lookupSolution(
  solutions: SolutionDataMap,
  solutionId: EntityId,
): SolutionData | undefined {
  return solutions[String(solutionId)];
}

function pickUsedSolutionIdsForPrimary(
  inventory: number[],
  primarySolutionId: EntityId,
  requiredUses: number,
): EntityId[] {
  const matches = inventory.filter((solutionId) => solutionId === primarySolutionId);

  if (matches.length < requiredUses) {
    return [];
  }

  return matches.slice(0, requiredUses);
}

function pickUsedSolutionIdsForSecondary(
  inventory: number[],
  solutions: SolutionDataMap,
  requiredType: number,
  requiredUses: number,
): EntityId[] {
  const matches = inventory
    .filter((solutionId) => lookupSolution(solutions, solutionId)?.mSolutionType === requiredType)
    .sort((left, right) => left - right);

  if (matches.length < requiredUses) {
    return [];
  }

  return matches.slice(0, requiredUses);
}

function primaryRollForSlot(
  rolls: EncounterRollSnapshot,
  slot: EncounterSlotLetter,
): number {
  return {
    A: rolls.rollPrimaryA,
    B: rolls.rollPrimaryB,
    C: rolls.rollPrimaryC,
    D: rolls.rollPrimaryD,
  }[slot];
}

function secondaryRollForSlot(
  rolls: EncounterRollSnapshot,
  slot: EncounterSlotLetter,
): number {
  return {
    A: rolls.rollSecondaryA,
    B: rolls.rollSecondaryB,
    C: rolls.rollSecondaryC,
    D: rolls.rollSecondaryD,
  }[slot];
}

function evaluatePrimaryLane(
  requirement: SlotRequirement,
  inventory: number[],
  roll: number,
  requiredUses: number,
): SlotEvaluation {
  const { primarySolutionId } = requirement;

  if (primarySolutionId === 0) {
    return { satisfied: true, inventoryValid: false, lane: null, roll: null, usedSolutionIds: [] };
  }

  const usedSolutionIds = pickUsedSolutionIdsForPrimary(
    inventory,
    primarySolutionId,
    requiredUses,
  );
  const inventoryValid = usedSolutionIds.length >= requiredUses;

  if (!inventoryValid) {
    return { satisfied: false, inventoryValid: false, lane: null, roll: null, usedSolutionIds: [] };
  }

  return {
    satisfied: isRollFavorable(roll),
    inventoryValid: true,
    lane: 'primary',
    roll,
    usedSolutionIds,
  };
}

function evaluateSecondaryLane(
  requirement: SlotRequirement,
  inventory: number[],
  solutionMap: SolutionDataMap,
  roll: number,
  requiredUses: number,
): SlotEvaluation {
  const { secondarySolutionType } = requirement;

  if (secondarySolutionType === 0) {
    return { satisfied: true, inventoryValid: false, lane: null, roll: null, usedSolutionIds: [] };
  }

  const usedSolutionIds = pickUsedSolutionIdsForSecondary(
    inventory,
    solutionMap,
    secondarySolutionType,
    requiredUses,
  );
  const inventoryValid = usedSolutionIds.length >= requiredUses;

  if (!inventoryValid) {
    return { satisfied: false, inventoryValid: false, lane: null, roll: null, usedSolutionIds: [] };
  }

  return {
    satisfied: isRollFavorable(roll),
    inventoryValid: true,
    lane: 'secondary',
    roll,
    usedSolutionIds,
  };
}

function evaluateSlot(
  slot: EncounterSlotLetter,
  requirement: SlotRequirement,
  inventory: number[],
  solutionMap: SolutionDataMap,
  rolls: EncounterRollSnapshot,
  requiredUses: number,
): SlotEvaluation {
  const primaryEvaluation = evaluatePrimaryLane(
    requirement,
    inventory,
    primaryRollForSlot(rolls, slot),
    requiredUses,
  );

  if (primaryEvaluation.inventoryValid) {
    return primaryEvaluation;
  }

  return evaluateSecondaryLane(
    requirement,
    inventory,
    solutionMap,
    secondaryRollForSlot(rolls, slot),
    requiredUses,
  );
}

function randomInt(maxExclusive: number): number {
  return cryptoRandomInt(0, maxExclusive);
}

function pickRandomRewards(
  encounter: EncounterData,
  solutions: SolutionDataMap,
): EntityId[] {
  const rewardType = encounter.mEncounterRewardType;
  const amount = Math.max(0, encounter.mEncounterRewardAmount);

  if (amount === 0) {
    return [];
  }

  const candidates = Object.values(solutions)
    .filter((solution) => solution.mSolutionRewardType === rewardType);

  if (candidates.length === 0) {
    return [];
  }

  const rewards: EntityId[] = [];
  let pool = [...candidates];

  for (let index = 0; index < amount; index += 1) {
    if (pool.length === 0) {
      pool = [...candidates];
    }

    const rewardIndex = randomInt(pool.length);
    const [reward] = pool.splice(rewardIndex, 1);
    rewards.push(reward.mSolutionID);
  }

  return rewards;
}

function pickRewards(
  encounter: EncounterData,
  solutions: SolutionDataMap,
): EntityId[] {
  return pickRandomRewards(encounter, solutions);
}

function buildMessage(
  encounter: EncounterData,
  success: boolean,
  selectedAction: SelectedEncounterAction,
  rolls: EncounterRollSnapshot,
  failedSlots: EncounterSlotLetter[],
  actionEvaluation?: SlotEvaluation,
): string {
  const title =
    encounter.mEncounterTitle || `Encounter ${encounter.mEncounterID}`;

  if (selectedAction.mode === 'dice') {
    const outcome = interpretRoll(rolls.rollE) ?? 'unmapped';
    return success
      ? `${title}: dice override succeeded (rollE=${rolls.rollE}→${outcome}).`
      : `${title}: dice override failed (rollE=${rolls.rollE}→${outcome}).`;
  }

  const slot = selectedAction.slot;
  const requirement = buildSlotRequirements(encounter)[slot];
  const lane = actionEvaluation?.lane
    ?? (requirement.primarySolutionId !== 0 ? 'primary' : 'secondary');
  const roll = actionEvaluation?.roll
    ?? (lane === 'primary'
      ? primaryRollForSlot(rolls, slot)
      : secondaryRollForSlot(rolls, slot));
  const outcome = interpretRoll(roll) ?? 'unmapped';

  if (success) {
    return `${title}: slot ${slot} (${lane}) succeeded (roll${slot}=${roll}→${outcome}).`;
  }

  const parts = [
    `slot ${slot} (${lane}) failed (roll${slot}=${roll}→${outcome})`,
  ];

  if (failedSlots.length > 0) {
    parts.push(`other unresolved slots: ${failedSlots.join(', ')}`);
  }

  return `${title}: ${parts.join('; ')}.`;
}

function emptySlotResults(): EncounterSlotResults {
  return { A: false, B: false, C: false, D: false };
}

function assertSelectedAction(selectedAction: SelectedEncounterAction): void {
  if (selectedAction.mode === 'dice') {
    return;
  }
  if (!selectedAction.slot) {
    throw new Error('selectedAction.slot is required when mode is "slot"');
  }
}

/**
 * Pure encounter evaluation. Rolls are read-only; fate uses the global outcome table.
 */
export function resolveEncounter(
  encounter: EncounterData,
  inventory: number[],
  solutionMap: SolutionDataMap,
  rolls: EncounterRollSnapshot,
  selectedAction: SelectedEncounterAction,
  rewardIds?: EntityId[],
): EncounterResolution {
  assertSelectedAction(selectedAction);

  const frozenRolls = createEncounterRollSnapshot(rolls);
  const requirements = buildSlotRequirements(encounter);
  const requiredUses = Math.max(1, encounter.mEncounterDifficulty);
  const failurePenalty = encounterDifficultyLossMultiplier(
    encounter.mEncounterDifficulty,
  );

  if (selectedAction.mode === 'dice') {
    const success = isRollFavorable(frozenRolls.rollE);

    return {
      encounterId: encounter.mEncounterID,
      success,
      selectedRoll: frozenRolls.rollE,
      slotResults: emptySlotResults(),
      usedInventorySolutions: [],
      failurePenalty,
      rewards: success ? (rewardIds ?? pickRewards(encounter, solutionMap)) : [],
      message: buildMessage(
        encounter,
        success,
        selectedAction,
        frozenRolls,
        [],
      ),
    };
  }

  const slotResults: EncounterSlotResults = {
    A: true,
    B: true,
    C: true,
    D: true,
  };
  const failedSlots: EncounterSlotLetter[] = [];

  for (const slot of ENCOUNTER_SLOTS) {
    const requirement = requirements[slot];
    const evaluation = evaluateSlot(
      slot,
      requirement,
      inventory,
      solutionMap,
      frozenRolls,
      requiredUses,
    );

    slotResults[slot] = evaluation.satisfied;

    if (isSlotRequired(requirement)) {
      if (!evaluation.satisfied) {
        failedSlots.push(slot);
      }
    }
  }

  const actionEvaluation = evaluateSlot(
    selectedAction.slot,
    requirements[selectedAction.slot],
    inventory,
    solutionMap,
    frozenRolls,
    requiredUses,
  );

  const success = actionEvaluation.inventoryValid && actionEvaluation.satisfied;
  const selectedRoll = actionEvaluation.roll
    ?? primaryRollForSlot(frozenRolls, selectedAction.slot);

  return {
    encounterId: encounter.mEncounterID,
    success,
    selectedRoll,
    slotResults,
    usedInventorySolutions: actionEvaluation.inventoryValid
      ? actionEvaluation.usedSolutionIds
      : [],
    failurePenalty,
    rewards: success ? (rewardIds ?? pickRewards(encounter, solutionMap)) : [],
    message: buildMessage(
      encounter,
      success,
      selectedAction,
      frozenRolls,
      failedSlots.filter((s) => s !== selectedAction.slot),
      actionEvaluation,
    ),
  };
}
