import { interpretRoll, isRollFavorable } from './diceInterpreter';
import {
  ENCOUNTER_SLOTS,
  EncounterData,
  EncounterSlotLetter,
  EntityId,
  SolutionData,
  SolutionDataMap,
  encounterDifficultyLossMultiplier,
} from './types';

/**
 * Immutable precomputed rolls assigned at encounter creation.
 * A/C = primary lanes · B/D = secondary lanes · E = dice override
 */
export interface EncounterRollSnapshot {
  readonly rollA: number;
  readonly rollB: number;
  readonly rollC: number;
  readonly rollD: number;
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
  slotResults: EncounterSlotResults;
  usedInventorySolutions: number[];
  failurePenalty: number;
  rewards: number[];
  message: string;
}

/** Fixed slot → roll mapping (no deviations). */
const SLOT_ROLL_KEY: Record<
  EncounterSlotLetter,
  keyof EncounterRollSnapshot
> = {
  A: 'rollA',
  B: 'rollB',
  C: 'rollC',
  D: 'rollD',
};

/** Primary solution-id lanes. */
const PRIMARY_SLOTS: readonly EncounterSlotLetter[] = ['A', 'C'];

/** Secondary solution-type lanes. */
const SECONDARY_SLOTS: readonly EncounterSlotLetter[] = ['B', 'D'];

interface SlotRequirement {
  primarySolutionId: EntityId;
  secondarySolutionType: number;
}

type SlotRequirementMap = Record<EncounterSlotLetter, SlotRequirement>;

interface SlotEvaluation {
  satisfied: boolean;
  inventoryValid: boolean;
  usedSolutionId: EntityId | null;
}

export function createEncounterRollSnapshot(
  rolls: EncounterRollSnapshot,
): EncounterRollSnapshot {
  return Object.freeze({
    rollA: rolls.rollA,
    rollB: rolls.rollB,
    rollC: rolls.rollC,
    rollD: rolls.rollD,
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

function isPrimaryLane(slot: EncounterSlotLetter): boolean {
  return (PRIMARY_SLOTS as readonly string[]).includes(slot);
}

function isSlotRequired(
  slot: EncounterSlotLetter,
  requirement: SlotRequirement,
): boolean {
  if (isPrimaryLane(slot)) {
    return requirement.primarySolutionId !== 0;
  }
  return requirement.secondarySolutionType !== 0;
}

function lookupSolution(
  solutions: SolutionDataMap,
  solutionId: EntityId,
): SolutionData | undefined {
  return solutions[String(solutionId)];
}

function findSecondaryMatch(
  inventory: number[],
  solutions: SolutionDataMap,
  requiredType: number,
): EntityId | null {
  const matches: EntityId[] = [];

  for (const solutionId of inventory) {
    const definition = lookupSolution(solutions, solutionId);
    if (definition && definition.mSolutionType === requiredType) {
      matches.push(solutionId);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  return Math.min(...matches);
}

function rollForSlot(
  rolls: EncounterRollSnapshot,
  slot: EncounterSlotLetter,
): number {
  return rolls[SLOT_ROLL_KEY[slot]];
}

/** Primary lane (A, C): exact solution id in inventory + global roll fate. */
function evaluatePrimaryLane(
  requirement: SlotRequirement,
  inventory: number[],
  roll: number,
): SlotEvaluation {
  const { primarySolutionId } = requirement;

  if (primarySolutionId === 0) {
    return { satisfied: true, inventoryValid: false, usedSolutionId: null };
  }

  const inventoryValid = inventory.includes(primarySolutionId);

  if (!inventoryValid) {
    return { satisfied: false, inventoryValid: false, usedSolutionId: null };
  }

  return {
    satisfied: isRollFavorable(roll),
    inventoryValid: true,
    usedSolutionId: primarySolutionId,
  };
}

/** Secondary lane (B, D): matching solution type in inventory + global roll fate. */
function evaluateSecondaryLane(
  requirement: SlotRequirement,
  inventory: number[],
  solutionMap: SolutionDataMap,
  roll: number,
): SlotEvaluation {
  const { secondarySolutionType } = requirement;

  if (secondarySolutionType === 0) {
    return { satisfied: true, inventoryValid: false, usedSolutionId: null };
  }

  const matchedId = findSecondaryMatch(
    inventory,
    solutionMap,
    secondarySolutionType,
  );
  const inventoryValid = matchedId !== null;

  if (!inventoryValid) {
    return { satisfied: false, inventoryValid: false, usedSolutionId: null };
  }

  return {
    satisfied: isRollFavorable(roll),
    inventoryValid: true,
    usedSolutionId: matchedId,
  };
}

function evaluateSlot(
  slot: EncounterSlotLetter,
  requirement: SlotRequirement,
  inventory: number[],
  solutionMap: SolutionDataMap,
  rolls: EncounterRollSnapshot,
): SlotEvaluation {
  const roll = rollForSlot(rolls, slot);

  if (isPrimaryLane(slot)) {
    return evaluatePrimaryLane(requirement, inventory, roll);
  }

  return evaluateSecondaryLane(requirement, inventory, solutionMap, roll);
}

function pickMockRewards(
  encounter: EncounterData,
  solutions: SolutionDataMap,
): EntityId[] {
  const rewardType = encounter.mEncounterRewardType;
  const amount = Math.max(0, encounter.mEncounterRewardAmount);

  const candidates = Object.values(solutions)
    .filter((solution) => solution.mSolutionRewardType === rewardType)
    .sort((a, b) => a.mSolutionID - b.mSolutionID);

  return candidates.slice(0, amount).map((solution) => solution.mSolutionID);
}

function buildMessage(
  encounter: EncounterData,
  success: boolean,
  selectedAction: SelectedEncounterAction,
  rolls: EncounterRollSnapshot,
  failedSlots: EncounterSlotLetter[],
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
  const roll = rollForSlot(rolls, slot);
  const outcome = interpretRoll(roll) ?? 'unmapped';
  const lane = isPrimaryLane(slot) ? 'primary' : 'secondary';

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
): EncounterResolution {
  assertSelectedAction(selectedAction);

  const frozenRolls = createEncounterRollSnapshot(rolls);
  const requirements = buildSlotRequirements(encounter);
  const failurePenalty = encounterDifficultyLossMultiplier(
    encounter.mEncounterDifficulty,
  );

  if (selectedAction.mode === 'dice') {
    const success = isRollFavorable(frozenRolls.rollE);

    return {
      encounterId: encounter.mEncounterID,
      success,
      slotResults: emptySlotResults(),
      usedInventorySolutions: [],
      failurePenalty,
      rewards: success ? pickMockRewards(encounter, solutionMap) : [],
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
  let anySlotValid = false;

  for (const slot of ENCOUNTER_SLOTS) {
    const requirement = requirements[slot];
    const evaluation = evaluateSlot(
      slot,
      requirement,
      inventory,
      solutionMap,
      frozenRolls,
    );

    slotResults[slot] = evaluation.satisfied;

    if (isSlotRequired(slot, requirement)) {
      if (evaluation.inventoryValid) {
        anySlotValid = true;
      }
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
  );

  const success = anySlotValid && actionEvaluation.satisfied;
  const usedInventorySolutions =
    actionEvaluation.usedSolutionId !== null
      ? [actionEvaluation.usedSolutionId]
      : [];

  return {
    encounterId: encounter.mEncounterID,
    success,
    slotResults,
    usedInventorySolutions,
    failurePenalty,
    rewards: success ? pickMockRewards(encounter, solutionMap) : [],
    message: buildMessage(
      encounter,
      success,
      selectedAction,
      frozenRolls,
      failedSlots.filter((s) => s !== selectedAction.slot),
    ),
  };
}
