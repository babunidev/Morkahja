/**
 * Rare solutions (Babuni, 2026-11-23): the items drawn with the rare frame.
 * They are the Atranor items (solution type 77), anything else kept in the
 * essence inventory that is not an essence (the Frostbane Glaive, the
 * Zephyrstring Lyre), and icons named legendary or epic (the Titanpike).
 * Essences (solution type 15) are not rare. The client draws the rare frame
 * from this rule, and the server adds the rare roll bonus with it.
 */
export interface SolutionRarityRecord {
  mSolutionIconName: string;
  mSolutionInventoryType: number;
  mSolutionType: number;
}

export const ESSENCE_SOLUTION_TYPE = 15;
export const ESSENCE_INVENTORY_TYPE = 3;
/** The Atranor items. */
export const EPIC_SOLUTION_TYPE = 77;

/** A rare item adds this to every roll made with it, on top of its slot's bonus. */
export const RARE_SOLUTION_ROLL_BONUS = 1;

export function isRareSolution(record: SolutionRarityRecord | null | undefined): boolean {
  if (!record || record.mSolutionType === ESSENCE_SOLUTION_TYPE) {
    return false;
  }
  const icon = (record.mSolutionIconName ?? '').toLowerCase();
  return record.mSolutionType === EPIC_SOLUTION_TYPE
    || record.mSolutionInventoryType === ESSENCE_INVENTORY_TYPE
    || icon.includes('legendary')
    || icon.includes('_epic_');
}

/** The roll bonus a solution brings by itself: 1 when rare, else 0. */
export function solutionRarityRollBonus(record: SolutionRarityRecord | null | undefined): number {
  return isRareSolution(record) ? RARE_SOLUTION_ROLL_BONUS : 0;
}
