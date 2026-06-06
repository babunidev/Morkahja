import type { RollOutcome } from './diceInterpreter.js';

export const DEATH_ENCOUNTER_ID = 1;

export function isDeathEncounterSurvivalOutcome(outcome: RollOutcome | null): boolean {
  return outcome === 'Disengage' || outcome === 'Fortune' || outcome === 'Prosperity';
}

export function deathEncounterEssenceUses(outcome: RollOutcome | null): number {
  switch (outcome) {
    case 'Disengage':
      return 1;
    case 'Fortune':
      return 2;
    case 'Prosperity':
      return 3;
    default:
      return 0;
  }
}
