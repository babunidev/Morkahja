import {
  ESSENCE_SOLUTION_TYPE,
  isRareSolution,
  type SolutionRarityRecord,
} from '@shared/solutionRarity.js';

/**
 * The inventory in three lists (Babuni, 2026-11-23): normal items on top, rare
 * items below them, the gods' essences at the bottom, with a divider between.
 * Each list keeps the order it is given. Empty lists are left out, so a divider
 * only stands between two lists that have something in them.
 */
export function inventorySections<T extends { solutionId: number; solutionType: number }>(
  entries: readonly T[],
  recordFor: (solutionId: number) => SolutionRarityRecord | undefined,
): T[][] {
  const normal: T[] = [];
  const rare: T[] = [];
  const essences: T[] = [];
  for (const entry of entries) {
    if (entry.solutionType === ESSENCE_SOLUTION_TYPE) {
      essences.push(entry);
    } else if (isRareSolution(recordFor(entry.solutionId))) {
      rare.push(entry);
    } else {
      normal.push(entry);
    }
  }
  return [normal, rare, essences].filter((section) => section.length > 0);
}
