import { createEncounterRollSnapshot } from './encounterResolver.js';
import type { EncounterRollSnapshot } from './encounterResolver.js';

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Generate a constrained 5-roll snapshot at encounter creation.
 * Primary lanes (A, C): 61–100 · Secondary lanes (B, D): 40–100 · Dice (E): 1–100
 */
export function generateEncounterRollSnapshot(): EncounterRollSnapshot {
  const rollPrimaryA = randomInt(61, 100);
  const rollPrimaryB = randomInt(61, 100);
  const rollPrimaryC = randomInt(61, 100);
  const rollPrimaryD = randomInt(61, 100);
  const rollSecondaryA = randomInt(40, 100);
  const rollSecondaryB = randomInt(40, 100);
  const rollSecondaryC = randomInt(40, 100);
  const rollSecondaryD = randomInt(40, 100);

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
  });
}
