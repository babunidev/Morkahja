import { createEncounterRollSnapshot } from './encounterResolver';
import type { EncounterRollSnapshot } from './encounterResolver';

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Generate a constrained 5-roll snapshot at encounter creation.
 * Primary lanes (A, C): 61–100 · Secondary lanes (B, D): 40–100 · Dice (E): 1–100
 */
export function generateEncounterRollSnapshot(): EncounterRollSnapshot {
  return createEncounterRollSnapshot({
    rollA: randomInt(61, 100),
    rollB: randomInt(40, 100),
    rollC: randomInt(61, 100),
    rollD: randomInt(40, 100),
    rollE: randomInt(1, 100),
  });
}
