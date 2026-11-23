import {
  DICE_ROLL_BONUS,
  PRIMARY_SOLUTION_ROLL_BONUS,
  SECONDARY_SOLUTION_ROLL_BONUS,
  finalizeRoll,
} from './diceInterpreter.js';
import { createEncounterRollSnapshot } from './encounterResolver.js';
import type { EncounterRollSnapshot, SolutionSetExtraRolls } from './encounterResolver.js';
import { MAX_SOLUTION_SET_SIZE } from '@shared/solutionSet.js';

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function laneExtras(bonus: number, difficulty: number): Record<'A' | 'B' | 'C' | 'D', number[]> {
  const extras = (): number[] => Array.from(
    { length: MAX_SOLUTION_SET_SIZE - 1 },
    () => finalizeRoll(randomInt(1, 20), bonus, difficulty),
  );
  return { A: extras(), B: extras(), C: extras(), D: extras() };
}

/** Further copies of one slot use the same bonus and difficulty as that slot. */
export function generateSolutionSetExtraRolls(difficulty: number): SolutionSetExtraRolls {
  return {
    primary: laneExtras(PRIMARY_SOLUTION_ROLL_BONUS, difficulty),
    secondary: laneExtras(SECONDARY_SOLUTION_ROLL_BONUS, difficulty),
  };
}

/**
 * Fair d20 per lane, then the lane bonus and the difficulty penalty.
 * Primary +5 · Secondary +2 · Dice +0. The stored number is that total, even past 20.
 * A rare item's +1 is added when the roll is used (encounterResolver), not stored here.
 */
export function generateEncounterRollSnapshot(difficulty: number): EncounterRollSnapshot {
  const primary = () => finalizeRoll(randomInt(1, 20), PRIMARY_SOLUTION_ROLL_BONUS, difficulty);
  const secondary = () => finalizeRoll(randomInt(1, 20), SECONDARY_SOLUTION_ROLL_BONUS, difficulty);
  const rollPrimaryA = primary();
  const rollPrimaryB = primary();
  const rollPrimaryC = primary();
  const rollPrimaryD = primary();
  const rollSecondaryA = secondary();
  const rollSecondaryB = secondary();
  const rollSecondaryC = secondary();
  const rollSecondaryD = secondary();

  return createEncounterRollSnapshot({
    rollA: rollPrimaryA,
    rollB: rollSecondaryB,
    rollC: rollPrimaryC,
    rollD: rollSecondaryD,
    rollPrimaryA,
    rollPrimaryB,
    rollPrimaryC,
    rollPrimaryD,
    rollSecondaryA,
    rollSecondaryB,
    rollSecondaryC,
    rollSecondaryD,
    rollE: finalizeRoll(randomInt(1, 20), DICE_ROLL_BONUS, difficulty),
    extraRolls: generateSolutionSetExtraRolls(difficulty),
    diceFillRolls: Array.from(
      { length: MAX_SOLUTION_SET_SIZE - 1 },
      () => finalizeRoll(randomInt(1, 20), DICE_ROLL_BONUS, difficulty),
    ),
  });
}
