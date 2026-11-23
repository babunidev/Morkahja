export const DEATH_ENCOUNTER_ID = 1;

/**
 * Atranor (Babuni, 2026-11-23, D-055). The roll's total decides, not its tier:
 * 7 or more brings the avatar back with one essence of its own element's gods,
 * 14 or more with the second god's as well, 20 or more with all three. Using
 * an Atranor item always brings all three, and it still rolls to survive.
 * Each essence comes with one charge. 6 or less ends the life.
 */
export const ATRANOR_SURVIVAL_MIN_TOTAL = 7;
export const ATRANOR_SECOND_GOD_MIN_TOTAL = 14;
export const ATRANOR_THIRD_GOD_MIN_TOTAL = 20;
/** The gods of one element, one per tribunal. */
export const ATRANOR_ELEMENT_GOD_COUNT = 3;
/** Charges of each essence Atranor grants. */
export const ATRANOR_ESSENCE_CHARGES = 1;

export function isAtranorSurvivalRoll(total: number | null | undefined): boolean {
  return typeof total === 'number'
    && Number.isFinite(total)
    && Math.round(total) >= ATRANOR_SURVIVAL_MIN_TOTAL;
}

/** How many different gods' essences a surviving Atranor roll brings: 0 when the life ends. */
export function atranorEssenceGodCount(
  total: number | null | undefined,
  usedAtranorItem: boolean,
): number {
  if (!isAtranorSurvivalRoll(total)) {
    return 0;
  }
  if (usedAtranorItem) {
    return ATRANOR_ELEMENT_GOD_COUNT;
  }
  const rounded = Math.round(total as number);
  if (rounded >= ATRANOR_THIRD_GOD_MIN_TOTAL) {
    return 3;
  }
  if (rounded >= ATRANOR_SECOND_GOD_MIN_TOTAL) {
    return 2;
  }
  return 1;
}
