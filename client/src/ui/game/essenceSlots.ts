/**
 * Five essence slots on the local avatar's portrait (Babuni's direction,
 * 2026-11-13): the lives the avatar carries, shown on the bottom edge of the
 * round portrait. They are a view of the essences in the inventory, with
 * their own timing:
 *
 * - Each slot holds one particular essence and keeps it: the slots never
 *   reshuffle when another essence comes or goes (fix, 2026-11-13: slots used
 *   to show "the n-th essence in the list", so the remaining ones changed
 *   pictures after a loss).
 * - A lost essence leaves from the slot that holds it, and that slot stays
 *   empty for the rest of the encounter. An essence lost from the inventory
 *   beyond the five slots leaves no slot empty.
 * - When the next encounter begins, empty slots are refilled from the
 *   inventory with essences not already in a slot, as long as it holds more.
 * - A collected essence flies into a free slot; with all five filled it goes
 *   to the inventory.
 *
 * Counts are charges (an essence with two uses fills two slots), not
 * inventory entries. This store only shows; the inventory remains the server's.
 */

export const ESSENCE_SLOT_COUNT = 5;

/**
 * Slot positions from left to right along the bottom edge: 0 and 1 on the
 * left, 2 at the bottom centre, 3 and 4 on the right. They fill from the
 * centre outward and empty from the outside in.
 */
export const ESSENCE_FILL_ORDER = [2, 1, 3, 0, 4] as const;

/** An essence's solution id in each slot position 0–4, or null. */
export type EssenceSlotContents = readonly (number | null)[];

export interface EssenceSlotState {
  avatarId: string | null;
  /** The essence shown in each slot position. */
  slots: EssenceSlotContents;
  /** The essence flying into each slot position (shown empty until it lands). */
  incoming: EssenceSlotContents;
}

const EMPTY: EssenceSlotContents = Array.from({ length: ESSENCE_SLOT_COUNT }, () => null);

let state: EssenceSlotState = { avatarId: null, slots: EMPTY, incoming: EMPTY };
const listeners = new Set<() => void>();
const consumedKeys = new Set<string>();

function sameContents(left: EssenceSlotContents, right: EssenceSlotContents): boolean {
  return left.every((value, index) => value === right[index]);
}

function set(next: EssenceSlotState): void {
  if (
    next.avatarId === state.avatarId
    && sameContents(next.slots, state.slots)
    && sameContents(next.incoming, state.incoming)
  ) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener());
}

export function getEssenceSlots(): EssenceSlotState {
  return state;
}

export function subscribeEssenceSlots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** One entry per charge, in inventory order: [A, B, B] for A×1 and B×2. */
export function essenceCharges(
  essences: ReadonlyArray<{ solutionId: number; uses: number }> | undefined,
): number[] {
  return (essences ?? []).flatMap((item) =>
    item.uses > 0 ? Array.from({ length: item.uses }, () => item.solutionId) : [],
  );
}

function countCharges(charges: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of charges) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The first `count` charges placed from the centre outward. */
function placed(charges: readonly number[]): (number | null)[] {
  const slots: (number | null)[] = [...EMPTY];
  charges.slice(0, ESSENCE_SLOT_COUNT).forEach((id, index) => {
    slots[ESSENCE_FILL_ORDER[index]!] = id;
  });
  return slots;
}

/** Charges the inventory holds beyond those already in a slot (or flying into one). */
export function chargesNotInSlots(current: EssenceSlotState, charges: readonly number[]): number[] {
  const inSlots = countCharges(
    [...current.slots, ...current.incoming].filter((id): id is number => id !== null),
  );
  return charges.filter((id) => {
    const left = inSlots.get(id) ?? 0;
    if (left > 0) {
      inSlots.set(id, left - 1);
      return false;
    }
    return true;
  });
}

/** Pure rules, for tests. */
export function syncedState(current: EssenceSlotState, avatarId: string, charges: readonly number[]): EssenceSlotState {
  if (current.avatarId !== avatarId) {
    // Another avatar (or the first time): show what it carries, no animation.
    return { avatarId, slots: placed(charges), incoming: EMPTY };
  }
  // Keep every slot whose essence the avatar still has; a slot whose essence
  // is gone empties. Inner slots claim the charges first, so when an essence
  // has fewer charges than slots showing it, the outermost of those empties.
  const available = countCharges(charges);
  const slots: (number | null)[] = [...current.slots];
  for (const position of ESSENCE_FILL_ORDER) {
    const id = slots[position];
    if (id === null || id === undefined) {
      continue;
    }
    const left = available.get(id) ?? 0;
    if (left > 0) {
      available.set(id, left - 1);
    } else {
      slots[position] = null;
    }
  }
  return { ...current, slots };
}

/** Keeps the slots in step with the avatar and its essences. */
export function syncEssenceSlots(
  avatarId: string,
  essences: ReadonlyArray<{ solutionId: number; uses: number }> | undefined,
): void {
  set(syncedState(state, avatarId, essenceCharges(essences)));
}

/** The position of the slot at fill index `index`. */
export function slotPosition(index: number): number {
  return ESSENCE_FILL_ORDER[Math.max(0, Math.min(ESSENCE_SLOT_COUNT - 1, index))]!;
}

/**
 * Empties the slots holding the lost essence, up to `count`, once per `key`
 * (a result can re-render). Returns the emptied slots' positions, outermost
 * first; empty when the lost essence was not in a slot.
 */
export function takeFromEssenceSlots(solutionId: number, count: number, key: string): number[] {
  if (consumedKeys.has(key)) {
    return [];
  }
  consumedKeys.add(key);
  const slots = [...state.slots];
  const positions: number[] = [];
  for (const position of [...ESSENCE_FILL_ORDER].reverse()) {
    if (positions.length >= count) {
      break;
    }
    if (slots[position] === solutionId) {
      slots[position] = null;
      positions.push(position);
    }
  }
  set({ ...state, slots });
  return positions;
}

/** Reserves the next free slot for an arriving essence; null when all five are taken. */
export function reserveEssenceSlot(solutionId: number): number | null {
  const position = ESSENCE_FILL_ORDER.find(
    (candidate) => state.slots[candidate] === null && state.incoming[candidate] === null,
  );
  if (position === undefined) {
    return null;
  }
  const incoming = [...state.incoming];
  incoming[position] = solutionId;
  set({ ...state, incoming });
  return position;
}

/** The essence flying into `position` reached its slot. */
export function landEssenceInSlot(position: number): void {
  const id = state.incoming[position];
  if (id === null || id === undefined) {
    return;
  }
  const slots = [...state.slots];
  const incoming = [...state.incoming];
  slots[position] = id;
  incoming[position] = null;
  set({ ...state, slots, incoming });
}

/** The slot element on screen, for flights. */
export function essenceSlotElement(position: number): Element | null {
  return document.querySelector(`[data-essence-slot="${position}"]`);
}
