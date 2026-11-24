/** Global outcome tier for every encounter roll channel. */
export type RollOutcome =
  | 'Misery'
  | 'Hardship'
  | 'Disengage'
  | 'Fortune'
  | 'Prosperity';

/** Inclusive face of the encounter die. */
export const D20_MIN = 1;
export const D20_MAX = 20;

/**
 * Added to a fair d20 before difficulty is subtracted. The die bonus stays 0 until a later modifier.
 * Primary +5 and secondary +2 since 2026-11-23 (Babuni's balance pass); they were +7 and +5.
 * A rare item adds its own +1 on top (`@shared/solutionRarity.ts`).
 */
export const PRIMARY_SOLUTION_ROLL_BONUS = 5;
export const SECONDARY_SOLUTION_ROLL_BONUS = 2;
export const DICE_ROLL_BONUS = 0;

/**
 * The highest total any roll has ever stored: a natural 20 with the old +7.
 * Totals up to this are shown as they are; a number above it is an old 1–100 roll.
 */
export const HIGHEST_STORED_ROLL_TOTAL = 27;

/**
 * The highest total a roll can reach today (Babuni, 2026-11-24): a natural 20
 * in the primary slot (+5) with a rare item or a specialized skill (+1), at
 * difficulty 1. Rolling it rewards one red-yellow gem. When the bonuses
 * change, this number changes with them (a test checks it).
 */
export const TOP_ROLL_TOTAL = 26;

/** True for a total that reaches the top roll. */
export function isTopRoll(total: number | null | undefined): boolean {
  return typeof total === 'number' && Number.isFinite(total) && Math.round(total) >= TOP_ROLL_TOTAL;
}

/**
 * Difficulty 1 subtracts nothing. Each step above that subtracts one more
 * (difficulty 2 subtracts 1, 3 subtracts 2, 4 subtracts 3).
 */
export function difficultyRollPenalty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) {
    return 0;
  }

  return Math.max(0, Math.floor(difficulty) - 1);
}

/**
 * Fair d20, plus a lane bonus, minus the difficulty penalty.
 * The total is kept: a natural 20 with +5 is 25, and a natural 1 at difficulty 4 is −2.
 */
export function finalizeRoll(naturalRoll: number, bonus: number, difficulty: number): number {
  const total = naturalRoll + bonus - difficultyRollPenalty(difficulty);
  return Math.round(total);
}

export function isD20Face(roll: number): boolean {
  return Number.isInteger(roll) && roll >= D20_MIN && roll <= D20_MAX;
}

/**
 * Player-facing roll, after the lane bonus and the difficulty penalty.
 * `d20` when they cancel, `d20+5` when the face is raised, `d20-1` when it is lowered.
 */
export function formatRollNotation(bonus: number, difficulty: number): string {
  const net = bonus - difficultyRollPenalty(difficulty);

  if (net === 0) {
    return 'd20';
  }

  if (net > 0) {
    return `d20+${net}`;
  }

  return `d20${net}`;
}

/**
 * How a single finished total was made: the d20 face, then the lane bonus, then the difficulty penalty.
 * Null when the total is not one fair face plus those modifiers (a set average, or an old 1–100 roll).
 */
export function formatRollBreakdown(total: number, bonus: number, difficulty: number): string | null {
  if (!Number.isFinite(total) || !Number.isFinite(bonus)) {
    return null;
  }

  const penalty = difficultyRollPenalty(difficulty);
  const natural = Math.round(total) - Math.round(bonus) + penalty;
  if (!isD20Face(natural) || finalizeRoll(natural, bonus, difficulty) !== Math.round(total)) {
    return null;
  }

  const parts = [String(natural)];
  if (bonus > 0) {
    parts.push(`+ ${bonus}`);
  } else if (bonus < 0) {
    parts.push(`− ${Math.abs(bonus)}`);
  }
  if (penalty > 0) {
    parts.push(`− ${penalty}`);
  }
  return parts.join(' ');
}

/**
 * Single global interpretation table (no slot-specific logic).
 * 2 or lower Misery · 3–8 Hardship · 9–12 Disengage · 13–18 Fortune · 19 or higher Prosperity.
 * A total past 20, such as 26 or 27, stays Prosperity. A total below 1 stays Misery.
 */
export function interpretRoll(roll: number): RollOutcome | null {
  if (!Number.isFinite(roll)) {
    return null;
  }
  if (roll <= 2) {
    return 'Misery';
  }
  if (roll <= 8) {
    return 'Hardship';
  }
  if (roll <= 12) {
    return 'Disengage';
  }
  if (roll <= 18) {
    return 'Fortune';
  }
  return 'Prosperity';
}

/** Winning fate tiers for solution slots and dice override. */
export function isRollFavorable(roll: number): boolean {
  const outcome = interpretRoll(roll);
  return outcome === 'Fortune' || outcome === 'Prosperity';
}

/** Player-facing label for a roll outcome tier (internal enum values unchanged). */
export function displayRollOutcome(outcome: RollOutcome): string {
  if (outcome === 'Disengage') {
    return 'Fate';
  }

  return outcome;
}

/**
 * The stored roll is the total to show, including 26, 27, and totals below 1.
 * A number above the highest new total is still an old 1–100 roll, shown as its old d20 face.
 */
export function displayRollAsD20(roll: number): number {
  const rounded = Math.round(roll);
  if (rounded > HIGHEST_STORED_ROLL_TOTAL) {
    return Math.min(D20_MAX, Math.max(D20_MIN, Math.round(rounded / 5)));
  }
  return rounded;
}
