import { interpretRoll } from '@shared/diceInterpreter';
import {
  DEATH_ENCOUNTER_ID,
  isDeathEncounterSurvivalOutcome,
} from '@shared/deathEncounter';

export const LEVEL_UP_ENCOUNTER_ID = 2;
export { DEATH_ENCOUNTER_ID } from '@shared/deathEncounter';

export function visibleEncounterRewardIds({
  encounterId,
  prosperityRewardId,
  rewardIds,
  outcome,
}: {
  encounterId: number;
  prosperityRewardId?: number | null;
  rewardIds: number[];
  outcome: ReturnType<typeof interpretRoll>;
}): number[] {
  if (encounterId === LEVEL_UP_ENCOUNTER_ID) {
    return rewardIds;
  }

  if (encounterId === DEATH_ENCOUNTER_ID) {
    return outcome !== null && isDeathEncounterSurvivalOutcome(outcome)
      ? rewardIds
      : [];
  }

  if (outcome === null) {
    return [];
  }

  const successful = outcome === 'Fortune' || outcome === 'Prosperity';

  if (!successful) {
    return [];
  }

  return [
    ...rewardIds,
    ...(outcome === 'Prosperity' && prosperityRewardId ? [prosperityRewardId] : []),
  ];
}
