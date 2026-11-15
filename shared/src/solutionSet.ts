/**
 * Solution sets (Babuni's design, 2026-11-13): an encounter of difficulty N
 * needs N solutions. The player taps them one at a time (the same slot again
 * for another copy); each chosen solution rolls on its own. Each press of the
 * dice fills one missing place: the die spins, then rises and hovers, and the
 * next press pushes that die up. The set resolves when the places are full.
 * The rolls are averaged into one roll that decides the outcome. Each gap the
 * dice fills is its own roll and its own spin.
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

export interface SolutionSlotFace {
  solutionId: number;
  lane: 'primary' | 'secondary';
}

/**
 * The one item shown in each slot. A named item is claimed before any
 * alternative, and an item already claimed is not the face of a second slot.
 * Types come from the catalog, not from the type stored on the inventory row.
 */
export function slotFaces(
  requirements: SolutionSetRequirements,
  inventory: readonly number[],
  solutionTypeOf: (solutionId: number) => number | undefined,
): Partial<Record<SolutionSetSlot, SolutionSlotFace>> {
  const uses = new Map<number, number>();
  for (const solutionId of inventory) {
    uses.set(solutionId, (uses.get(solutionId) ?? 0) + 1);
  }

  const faces: Partial<Record<SolutionSetSlot, SolutionSlotFace>> = {};
  const claimed = new Set<number>();

  for (const slot of SOLUTION_SET_SLOTS) {
    const primarySolutionId = requirements[slot].primarySolutionId;
    if (primarySolutionId > 0 && (uses.get(primarySolutionId) ?? 0) >= 1) {
      faces[slot] = { solutionId: primarySolutionId, lane: 'primary' };
      claimed.add(primarySolutionId);
    }
  }

  for (const slot of SOLUTION_SET_SLOTS) {
    if (faces[slot]) {
      continue;
    }
    const secondarySolutionType = requirements[slot].secondarySolutionType;
    if (secondarySolutionType <= 0) {
      continue;
    }
    const candidate = [...uses.entries()]
      .filter(([solutionId, count]) => (
        count >= 1
        && !claimed.has(solutionId)
        && solutionTypeOf(solutionId) === secondarySolutionType
      ))
      .sort((left, right) => left[0] - right[0])[0];
    if (!candidate) {
      continue;
    }
    faces[slot] = { solutionId: candidate[0], lane: 'secondary' };
    claimed.add(candidate[0]);
  }

  return faces;
}

/**
 * Assigns one inventory charge to every pick, or returns null when the
 * inventory cannot cover the picks. Each pick spends the item placed in that
 * slot. Another copy of the same slot spends another charge of that same item.
 * A different item is not substituted. `inventory` holds one entry per charge.
 */
export function allocateSolutionSet(
  picks: readonly SolutionSetSlot[],
  requirements: SolutionSetRequirements,
  inventory: readonly number[],
  solutionTypeOf: (solutionId: number) => number | undefined,
): SolutionSetPickAllocation[] | null {
  const faces = slotFaces(requirements, inventory, solutionTypeOf);
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
    const face = faces[slot];
    if (!face || !take(face.solutionId)) {
      return null;
    }
    assigned[index] = { slot, lane: face.lane, solutionId: face.solutionId };
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
 * What one more press of the dice does in a set.
 * A set of one is not this path. A full set ignores the press.
 * Otherwise the die hovers and the set waits, until the press fills the last place.
 */
export function nextSetDiceRoll(
  setSize: number,
  solutionPicks: number,
  hoveredDice: number,
): 'ignore' | 'hover' | 'commit-dice' | 'commit-mixed' {
  if (setSize <= 1 || solutionPicks < 0 || hoveredDice < 0) {
    return 'ignore';
  }
  const filled = solutionPicks + hoveredDice;
  if (filled >= setSize) {
    return 'ignore';
  }
  if (filled + 1 < setSize) {
    return 'hover';
  }
  return solutionPicks > 0 ? 'commit-mixed' : 'commit-dice';
}

/**
 * One die face for each gap in a set. Snapshots from before each gap had its
 * own face only stored the first die, and that face fills every gap.
 */
export function diceFacesForGaps(
  gaps: number,
  first: number,
  further: readonly number[] | undefined,
): number[] {
  if (gaps <= 0) {
    return [];
  }
  if (!further) {
    return Array.from({ length: gaps }, () => first);
  }
  const faces = [first, ...further];
  return Array.from({ length: gaps }, (_, index) => faces[index] ?? first);
}

/**
 * The one roll of a set: the average of every chosen solution's roll and
 * every die that filled a gap. Rounded to the nearest whole total, which
 * can sit past 20.
 */
export function combineSolutionSetRolls(
  pickRolls: readonly number[],
  diceRolls: readonly number[] = [],
): number {
  const rolls = [...pickRolls, ...diceRolls];
  if (rolls.length === 0) {
    return 1;
  }
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  return Math.round(total / rolls.length);
}
