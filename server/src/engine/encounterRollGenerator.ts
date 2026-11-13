import { createEncounterRollSnapshot } from './encounterResolver.js';
import type { EncounterRollSnapshot, SolutionSetExtraRolls } from './encounterResolver.js';
import { MAX_SOLUTION_SET_SIZE } from '@shared/solutionSet.js';

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function laneExtras(min: number): Record<'A' | 'B' | 'C' | 'D', number[]> {
  const extras = (): number[] => Array.from(
    { length: MAX_SOLUTION_SET_SIZE - 1 },
    () => randomInt(min, 100),
  );
  return { A: extras(), B: extras(), C: extras(), D: extras() };
}

/** Rolls for further copies of one slot in a solution set, same ranges as the slot's own. */
export function generateSolutionSetExtraRolls(): SolutionSetExtraRolls {
  return { primary: laneExtras(61), secondary: laneExtras(50) };
}

/**
 * Generate a constrained 5-roll snapshot at encounter creation.
 * Primary lanes (A, C): 61–100 · Secondary lanes (B, D): 50–100 · Dice (E): 1–100
 */
export function generateEncounterRollSnapshot(): EncounterRollSnapshot {
  const rollPrimaryA = randomInt(61, 100);
  const rollPrimaryB = randomInt(61, 100);
  const rollPrimaryC = randomInt(61, 100);
  const rollPrimaryD = randomInt(61, 100);
  const rollSecondaryA = randomInt(50, 100);
  const rollSecondaryB = randomInt(50, 100);
  const rollSecondaryC = randomInt(50, 100);
  const rollSecondaryD = randomInt(50, 100);

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
    rollE: randomInt(1, 100),
    extraRolls: generateSolutionSetExtraRolls(),
  });
}
