/** A finished total of 25 grants one extra normal item (D-038). */
export const ROLL_25_TOTAL = 25;

/** The reward row holds five. A sixth item is not added. */
export const REWARD_ROW_CAP = 5;

/** When the row is already full, one of those rewards gains this many charges. */
export const ROLL_25_EXTRA_CHARGES = 2;

export interface RewardChargeBonus {
  solutionId: number;
  charges: number;
}

export interface Roll25RewardResult {
  rewardIds: number[];
  chargeBonus: RewardChargeBonus | null;
}

/**
 * A total of 25 adds one normal item. When the encounter already granted
 * five rewards, that item is not added: one of those five gains two charges.
 * `encounterRewards` is the encounter's own list, before a prosperity essence.
 */
export function rewardForRoll25({
  selectedRoll,
  success,
  encounterRewards,
  currentRewards,
  normalItemIds,
  pickIndex,
}: {
  selectedRoll: number;
  success: boolean;
  encounterRewards: readonly number[];
  currentRewards: readonly number[];
  normalItemIds: readonly number[];
  pickIndex: (length: number) => number;
}): Roll25RewardResult {
  const rewardIds = [...currentRewards];

  if (!success || Math.round(selectedRoll) !== ROLL_25_TOTAL) {
    return { rewardIds, chargeBonus: null };
  }

  if (encounterRewards.length >= REWARD_ROW_CAP) {
    const row = encounterRewards.slice(0, REWARD_ROW_CAP);
    const solutionId = row[pickIndex(row.length)]!;
    return {
      rewardIds,
      chargeBonus: { solutionId, charges: ROLL_25_EXTRA_CHARGES },
    };
  }

  const already = new Set(rewardIds);
  let pool = normalItemIds.filter((id) => !already.has(id));
  if (pool.length === 0) {
    pool = [...normalItemIds];
  }
  if (pool.length === 0) {
    return { rewardIds, chargeBonus: null };
  }

  rewardIds.push(pool[pickIndex(pool.length)]!);
  return { rewardIds, chargeBonus: null };
}
