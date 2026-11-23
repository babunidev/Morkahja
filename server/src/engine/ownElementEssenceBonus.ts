/**
 * A successful finished total of 24 or higher grants one extra essence of the
 * avatar's own element, every time (Babuni, 2026-11-23). It comes on top of the
 * encounter's rewards and the prosperity essence. It replaces two earlier
 * rules: the extra normal item on a 25 (D-038) and the 20% chance of this
 * essence on 25 or higher (D-052).
 */
export const OWN_ESSENCE_BONUS_MIN_TOTAL = 24;

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
  /** Inclusive [min, max]; picks which of the element's essences. */
  randomInt: (min: number, max: number) => number;
}): number | null {
  if (!success || Math.round(selectedRoll) < OWN_ESSENCE_BONUS_MIN_TOTAL || ownEssenceIds.length === 0) {
    return null;
  }

  return ownEssenceIds[randomInt(0, ownEssenceIds.length - 1)]!;
}
