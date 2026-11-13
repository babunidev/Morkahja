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
import {
  allocateSolutionSet,
  combineSolutionSetRolls,
  solutionSetSize,
  type SolutionSetPickAllocation,
} from '@shared/solutionSet.js';

/**
 * Rolls for the second, third … copy of one slot's lane in a solution set
 * (the first copy uses the slot's own roll). Absent on snapshots created
 * before solution sets: every copy then reuses the slot's roll.
 */
export interface SolutionSetExtraRolls {
  readonly primary: Readonly<Record<EncounterSlotLetter, readonly number[]>>;
  readonly secondary: Readonly<Record<EncounterSlotLetter, readonly number[]>>;
}

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
  readonly extraRolls?: SolutionSetExtraRolls;
}

export type SelectedEncounterAction =
  | { mode: 'dice' }
  | {
    mode: 'slot';
    slot: EncounterSlotLetter;
    /**
     * The solution set, one entry per chosen solution (a slot repeats for
     * each copy). Absent from older clients: the slot alone, as many copies
     * as the encounter needs.
     */
    picks?: EncounterSlotLetter[];
    /** The dice finished the set, standing in for each missing solution. */
    diceFill?: boolean;
  };

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
  /** One entry per charge lost to failure penalties (Misery/Hardship). */
  lostInventorySolutions?: number[];
  failurePenalty: number;
  rewards: number[];
  message: string;
  /** Solution sets: each chosen solution's own roll, in the order chosen. */
  pickRolls?: number[];
  /** Solution sets finished by the dice: the dice roll (counted once per missing solution). */
  diceFillRoll?: number;
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
    ...(rolls.extraRolls ? { extraRolls: rolls.extraRolls } : {}),
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

interface SolutionSetEvaluation {
  valid: boolean;
  success: boolean;
  roll: number;
  usedSolutionIds: EntityId[];
  allocation: SolutionSetPickAllocation[];
  pickRolls: number[];
  diceFill: boolean;
}

function rollForSetPick(
  rolls: EncounterRollSnapshot,
  pick: SolutionSetPickAllocation,
): number {
  const base = pick.lane === 'primary'
    ? primaryRollForSlot(rolls, pick.slot)
    : secondaryRollForSlot(rolls, pick.slot);
  if (pick.copyIndex === 0) {
    return base;
  }
  return rolls.extraRolls?.[pick.lane][pick.slot][pick.copyIndex - 1] ?? base;
}

function evaluateSolutionSet(
  encounter: EncounterData,
  requirements: SlotRequirementMap,
  inventory: number[],
  solutionMap: SolutionDataMap,
  rolls: EncounterRollSnapshot,
  selectedAction: Extract<SelectedEncounterAction, { mode: 'slot' }>,
): SolutionSetEvaluation {
  const setSize = solutionSetSize(encounter.mEncounterDifficulty);
  const picks = selectedAction.picks ?? Array.from({ length: setSize }, () => selectedAction.slot);
  const diceFill = selectedAction.picks !== undefined && selectedAction.diceFill === true;
  const invalid: SolutionSetEvaluation = {
    valid: false,
    success: false,
    roll: primaryRollForSlot(rolls, selectedAction.slot),
    usedSolutionIds: [],
    allocation: [],
    pickRolls: [],
    diceFill,
  };

  if (
    picks.length === 0
    || picks.length > setSize
    || (picks.length < setSize && !diceFill)
    || (picks.length === setSize && diceFill)
  ) {
    return invalid;
  }

  const allocation = allocateSolutionSet(
    picks,
    requirements,
    inventory,
    (solutionId) => lookupSolution(solutionMap, solutionId)?.mSolutionType,
  );
  if (!allocation) {
    return invalid;
  }

  const pickRolls = allocation.map((pick) => rollForSetPick(rolls, pick));
  const roll = combineSolutionSetRolls(pickRolls, setSize, diceFill ? rolls.rollE : null);

  return {
    valid: true,
    success: isRollFavorable(roll),
    roll,
    usedSolutionIds: allocation.map((pick) => pick.solutionId),
    allocation,
    pickRolls,
    diceFill,
  };
}

/**
 * The picks of a solution set chosen so far, each with the item it takes and
 * its own roll; null when the inventory cannot cover them. Each pick is locked
 * and revealed as it is chosen (D-025); the final resolution uses the same
 * allocation, so the revealed rolls are the ones that count.
 */
export function revealSolutionSetPicks(
  encounter: EncounterData,
  inventory: number[],
  solutionMap: SolutionDataMap,
  rolls: EncounterRollSnapshot,
  picks: EncounterSlotLetter[],
): Array<{ slot: EncounterSlotLetter; solutionId: EntityId; roll: number }> | null {
  if (picks.length === 0 || picks.length > solutionSetSize(encounter.mEncounterDifficulty)) {
    return null;
  }
  const allocation = allocateSolutionSet(
    picks,
    buildSlotRequirements(encounter),
    inventory,
    (solutionId) => lookupSolution(solutionMap, solutionId)?.mSolutionType,
  );
  return allocation
    ? allocation.map((pick) => ({ slot: pick.slot, solutionId: pick.solutionId, roll: rollForSetPick(rolls, pick) }))
    : null;
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
  setEvaluation?: SolutionSetEvaluation,
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
  const roll = setEvaluation?.roll ?? primaryRollForSlot(rolls, slot);
  const outcome = interpretRoll(roll) ?? 'unmapped';
  const set = setEvaluation?.valid
    ? setEvaluation.allocation.map((pick) => `${pick.slot}(${pick.lane})`).join('+')
      + (setEvaluation.diceFill ? '+dice' : '')
    : `slot ${slot}`;

  if (success) {
    return `${title}: ${set} succeeded (roll=${roll}→${outcome}).`;
  }

  const parts = [
    `${set} failed (roll=${roll}→${outcome})`,
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

  const setEvaluation = evaluateSolutionSet(
    encounter,
    requirements,
    inventory,
    solutionMap,
    frozenRolls,
    selectedAction,
  );

  const success = setEvaluation.valid && setEvaluation.success;
  const selectedRoll = setEvaluation.roll;

  return {
    encounterId: encounter.mEncounterID,
    success,
    selectedRoll,
    slotResults,
    usedInventorySolutions: setEvaluation.usedSolutionIds,
    ...(setEvaluation.valid && (setEvaluation.pickRolls.length > 1 || setEvaluation.diceFill)
      ? {
        pickRolls: setEvaluation.pickRolls,
        ...(setEvaluation.diceFill ? { diceFillRoll: frozenRolls.rollE } : {}),
      }
      : {}),
    failurePenalty,
    rewards: success ? (rewardIds ?? pickRewards(encounter, solutionMap)) : [],
    message: buildMessage(
      encounter,
      success,
      selectedAction,
      frozenRolls,
      failedSlots.filter((s) => s !== selectedAction.slot),
      setEvaluation,
    ),
  };
}
