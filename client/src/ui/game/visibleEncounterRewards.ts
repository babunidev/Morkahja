import { interpretRoll } from '@shared/diceInterpreter';
import {
  DEATH_ENCOUNTER_ID,
  deathEncounterEssenceUses,
  isDeathEncounterSurvivalOutcome,
} from '@shared/deathEncounter';

export const LEVEL_UP_ENCOUNTER_ID = 2;
export { DEATH_ENCOUNTER_ID } from '@shared/deathEncounter';

export interface VisibleRewardEntry {
  quantity: number;
  solutionId: number;
}

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

/** Mirrors server grant size: one mSolutionUses charge per reward ID entry. */
export function rewardQuantityForVisibleEntry({
  encounterId,
  avatarLevel,
  outcome,
  solutionUses,
}: {
  encounterId: number;
  avatarLevel: number;
  outcome: ReturnType<typeof interpretRoll>;
  solutionUses: number;
}): number {
  if (encounterId === LEVEL_UP_ENCOUNTER_ID) {
    return Math.max(1, solutionUses + (avatarLevel + 1));
  }

  if (encounterId === DEATH_ENCOUNTER_ID && outcome) {
    return deathEncounterEssenceUses(outcome);
  }

  return Math.max(1, solutionUses);
}

export function visibleEncounterRewards({
  encounterId,
  prosperityRewardId,
  rewardIds,
  outcome,
  avatarLevel,
  getSolutionUses,
}: {
  encounterId: number;
  prosperityRewardId?: number | null;
  rewardIds: number[];
  outcome: ReturnType<typeof interpretRoll>;
  avatarLevel: number;
  getSolutionUses: (rewardId: number) => number | undefined;
}): VisibleRewardEntry[] {
  const merged = new Map<number, number>();

  for (const rewardId of visibleEncounterRewardIds({
    encounterId,
    prosperityRewardId,
    rewardIds,
    outcome,
  })) {
    const solutionUses = getSolutionUses(rewardId);

    if (solutionUses === undefined) {
      continue;
    }

    const quantity = rewardQuantityForVisibleEntry({
      encounterId,
      avatarLevel,
      outcome,
      solutionUses,
    });
    merged.set(rewardId, (merged.get(rewardId) ?? 0) + quantity);
  }

  return [...merged.entries()]
    .map(([solutionId, quantity]) => ({ solutionId, quantity }))
    .sort((left, right) => left.solutionId - right.solutionId);
}
