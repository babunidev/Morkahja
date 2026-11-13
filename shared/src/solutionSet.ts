/**
 * Solution sets (Babuni's design, 2026-11-13): an encounter of difficulty N
 * needs N solutions. The player taps them one at a time (the same slot again
 * for another copy); each chosen solution rolls on its own, and the dice can
 * finish an incomplete set, standing in for every missing solution. The
 * rolls are averaged into one roll that decides the outcome.
 *
 * Shared by the server (authoritative) and the client (which slots can still
 * be tapped), so both allocate inventory the same way.
 */

export type SolutionSetSlot = 'A' | 'B' | 'C' | 'D';

export const SOLUTION_SET_SLOTS: readonly SolutionSetSlot[] = ['A', 'B', 'C', 'D'];

/** Upper bound for a set; encounter difficulty is 1–4. */
export const MAX_SOLUTION_SET_SIZE = 4;

export interface SolutionSetSlotRequirement {
  primarySolutionId: number;
  secondarySolutionType: number;
}

export type SolutionSetRequirements = Record<SolutionSetSlot, SolutionSetSlotRequirement>;

export interface SolutionSetPickAllocation {
  slot: SolutionSetSlot;
  lane: 'primary' | 'secondary';
  solutionId: number;
  /** Which copy of this slot's lane this is (0 = first): selects its roll. */
  copyIndex: number;
}

/** How many solutions an encounter needs (difficulty, at least 1). */
export function solutionSetSize(encounterDifficulty: number | undefined): number {
  const difficulty = Math.floor(encounterDifficulty ?? 1);
  return Math.min(MAX_SOLUTION_SET_SIZE, Math.max(1, difficulty));
}

export function isSolutionSetSlot(value: unknown): value is SolutionSetSlot {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

/**
 * Assigns one inventory charge to every pick, or returns null when the
 * inventory cannot cover the picks. Primary items are taken first for all
 * picks, then the remaining picks take the lowest-id item of their slot's
 * alternative type, so an alternative never takes an item a primary needs.
 * `inventory` holds one entry per charge.
 */
export function allocateSolutionSet(
  picks: readonly SolutionSetSlot[],
  requirements: SolutionSetRequirements,
  inventory: readonly number[],
  solutionTypeOf: (solutionId: number) => number | undefined,
): SolutionSetPickAllocation[] | null {
  const remaining = [...inventory];
  const assigned: (Omit<SolutionSetPickAllocation, 'copyIndex'> | null)[] = picks.map(() => null);

  const take = (solutionId: number): boolean => {
    const index = remaining.indexOf(solutionId);
    if (index < 0) {
      return false;
    }
    remaining.splice(index, 1);
    return true;
  };

  picks.forEach((slot, index) => {
    const { primarySolutionId } = requirements[slot];
    if (primarySolutionId > 0 && take(primarySolutionId)) {
      assigned[index] = { slot, lane: 'primary', solutionId: primarySolutionId };
    }
  });

  for (let index = 0; index < picks.length; index += 1) {
    if (assigned[index]) {
      continue;
    }
    const slot = picks[index]!;
    const { secondarySolutionType } = requirements[slot];
    if (secondarySolutionType <= 0) {
      return null;
    }
    const candidate = remaining
      .filter((solutionId) => solutionTypeOf(solutionId) === secondarySolutionType)
      .sort((left, right) => left - right)[0];
    if (candidate === undefined || !take(candidate)) {
      return null;
    }
    assigned[index] = { slot, lane: 'secondary', solutionId: candidate };
  }

  const copies = new Map<string, number>();
  return assigned.map((entry) => {
    const pick = entry!;
    const key = `${pick.slot}:${pick.lane}`;
    const copyIndex = copies.get(key) ?? 0;
    copies.set(key, copyIndex + 1);
    return { ...pick, copyIndex };
  });
}

/**
 * The one roll of a set: the average of every chosen solution's roll, with
 * the dice roll counted once for each missing solution. Rounded to the
 * nearest whole roll (1–100).
 */
export function combineSolutionSetRolls(
  pickRolls: readonly number[],
  setSize: number,
  diceRoll: number | null,
): number {
  const missing = Math.max(0, setSize - pickRolls.length);
  const total = pickRolls.reduce((sum, roll) => sum + roll, 0)
    + (missing > 0 ? (diceRoll ?? 0) * missing : 0);
  const count = pickRolls.length + missing;
  if (count === 0) {
    return diceRoll ?? 1;
  }
  return Math.min(100, Math.max(1, Math.round(total / count)));
}
