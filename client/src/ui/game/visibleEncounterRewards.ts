import { interpretRoll } from '@shared/diceInterpreter';
import {
  ATRANOR_ESSENCE_CHARGES,
  DEATH_ENCOUNTER_ID,
  isAtranorSurvivalRoll,
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
  roll,
}: {
  encounterId: number;
  prosperityRewardId?: number | null;
  rewardIds: number[];
  outcome: ReturnType<typeof interpretRoll>;
  /** The finished total; Atranor decides by it, not by the tier (D-055). */
  roll?: number | null;
}): number[] {
  if (encounterId === LEVEL_UP_ENCOUNTER_ID) {
    return rewardIds;
  }

  if (encounterId === DEATH_ENCOUNTER_ID) {
    return isAtranorSurvivalRoll(roll) ? rewardIds : [];
  }

  if (outcome === null) {
    return [];
  }

  const successful = outcome === 'Fortune' || outcome === 'Prosperity';

  if (!successful) {
    return [];
  }

  // Server resolutions already include the prosperity essence in rewardIds
  // (withProsperityEssenceReward). Only append for pre-resolution preview.
  const shouldAppendProsperity =
    outcome === 'Prosperity'
    && prosperityRewardId != null
    && !rewardIds.includes(prosperityRewardId);

  return [
    ...rewardIds,
    ...(shouldAppendProsperity ? [prosperityRewardId] : []),
  ];
}

/** Mirrors server grant size: one mSolutionUses charge per reward ID entry. */
export function rewardQuantityForVisibleEntry({
  encounterId,
  avatarLevel,
  solutionUses,
}: {
  encounterId: number;
  avatarLevel: number;
  /** Kept for callers; Atranor's charges no longer depend on the tier (D-055). */
  outcome?: ReturnType<typeof interpretRoll>;
  solutionUses: number;
}): number {
  if (encounterId === LEVEL_UP_ENCOUNTER_ID) {
    return Math.max(1, solutionUses + (avatarLevel + 1));
  }

  if (encounterId === DEATH_ENCOUNTER_ID) {
    return ATRANOR_ESSENCE_CHARGES;
  }

  return Math.max(1, solutionUses);
}

export function visibleEncounterRewards({
  encounterId,
  prosperityRewardId,
  rewardIds,
  outcome,
  roll,
  avatarLevel,
  getSolutionUses,
  rewardChargeBonus,
}: {
  encounterId: number;
  prosperityRewardId?: number | null;
  rewardIds: number[];
  outcome: ReturnType<typeof interpretRoll>;
  /** The finished total; Atranor decides by it, not by the tier (D-055). */
  roll?: number | null;
  avatarLevel: number;
  getSolutionUses: (rewardId: number) => number | undefined;
  /** Two extra charges on one reward when a 25 filled an already full row (D-038). */
  rewardChargeBonus?: { solutionId: number; charges: number } | null;
}): VisibleRewardEntry[] {
  const merged = new Map<number, number>();

  for (const rewardId of visibleEncounterRewardIds({
    encounterId,
    prosperityRewardId,
    rewardIds,
    outcome,
    roll,
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

  if (
    rewardChargeBonus
    && rewardChargeBonus.charges > 0
    && merged.has(rewardChargeBonus.solutionId)
  ) {
    merged.set(
      rewardChargeBonus.solutionId,
      (merged.get(rewardChargeBonus.solutionId) ?? 0) + rewardChargeBonus.charges,
    );
  }

  return [...merged.entries()]
    .map(([solutionId, quantity]) => ({ solutionId, quantity }))
    .sort((left, right) => left.solutionId - right.solutionId);
}
