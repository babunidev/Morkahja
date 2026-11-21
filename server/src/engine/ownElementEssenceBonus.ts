/**
 * A finished total of 25 or higher has a 20% chance to grant one extra essence
 * of the avatar's own element (Babuni, 2026-11-21). It comes on top of the
 * encounter's rewards, the prosperity essence and a 25's extra item (D-038).
 */
export const OWN_ESSENCE_BONUS_MIN_TOTAL = 25;

/** One chance in five. */
export const OWN_ESSENCE_BONUS_CHANCE_IN = 5;

export function ownElementEssenceBonus({
  selectedRoll,
  success,
  ownEssenceIds,
  randomInt,
}: {
  selectedRoll: number;
  success: boolean;
  /** The essences of the avatar's own element; empty when it has none. */
  ownEssenceIds: readonly number[];
  /** Inclusive [min, max]. */
  randomInt: (min: number, max: number) => number;
}): number | null {
  if (!success || Math.round(selectedRoll) < OWN_ESSENCE_BONUS_MIN_TOTAL || ownEssenceIds.length === 0) {
    return null;
  }

  if (randomInt(1, OWN_ESSENCE_BONUS_CHANCE_IN) !== 1) {
    return null;
  }

  return ownEssenceIds[randomInt(0, ownEssenceIds.length - 1)]!;
}
