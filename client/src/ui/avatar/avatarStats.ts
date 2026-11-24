/**
 * How many different items or skills an avatar holds, each counted once
 * however many charges it has (Babuni, 2026-11-24), for the avatar card's
 * statistics. Entries without charges left are not held.
 */
export function distinctHeld(entries: ReadonlyArray<{ solutionId: number; uses: number }> | undefined): number {
  return new Set((entries ?? []).filter((entry) => entry.uses > 0).map((entry) => entry.solutionId)).size;
}
