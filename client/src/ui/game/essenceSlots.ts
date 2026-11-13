/**
 * Five essence slots on the local avatar's portrait (Babuni's direction,
 * 2026-11-13): the lives the avatar carries, shown on the bottom edge of the
 * round portrait. They are a view of the essences in the inventory, with
 * their own timing:
 *
 * - A lost essence leaves from a slot (the last one filled) and the slot
 *   stays empty for the rest of that encounter.
 * - When the next encounter begins, empty slots are refilled from the
 *   inventory, as long as it holds more essences.
 * - A collected essence flies into a free slot; with all five filled it goes
 *   to the inventory.
 *
 * This store only counts slots; the inventory remains the server's.
 */

export const ESSENCE_SLOT_COUNT = 5;

/**
 * Slot positions from left to right along the bottom edge: 0 and 1 on the
 * left, 2 at the bottom centre, 3 and 4 on the right. They fill from the
 * centre outward and empty from the outside in.
 */
export const ESSENCE_FILL_ORDER = [2, 1, 3, 0, 4] as const;

export interface EssenceSlotState {
  avatarId: string | null;
  /** Slots showing an essence. */
  filled: number;
  /** Slots an essence is flying into (shown empty until it lands). */
  incoming: number;
}

let state: EssenceSlotState = { avatarId: null, filled: 0, incoming: 0 };
const listeners = new Set<() => void>();
const consumedKeys = new Set<string>();

function set(next: EssenceSlotState): void {
  if (next.avatarId === state.avatarId && next.filled === state.filled && next.incoming === state.incoming) {
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

/** Pure rules, for tests. */
export function syncedState(current: EssenceSlotState, avatarId: string, total: number): EssenceSlotState {
  if (current.avatarId !== avatarId) {
    // Another avatar (or the first time): show what it carries, no animation.
    return { avatarId, filled: Math.min(ESSENCE_SLOT_COUNT, total), incoming: 0 };
  }
  // Never show more essences than the avatar has.
  const filled = Math.min(current.filled, total);
  return { ...current, filled, incoming: Math.min(current.incoming, Math.max(0, total - filled)) };
}

/** Keeps the slots in step with the avatar and its essence count. */
export function syncEssenceSlots(avatarId: string, total: number): void {
  set(syncedState(state, avatarId, total));
}

/** The position of the slot at fill index `index`. */
export function slotPosition(index: number): number {
  return ESSENCE_FILL_ORDER[Math.max(0, Math.min(ESSENCE_SLOT_COUNT - 1, index))]!;
}

/**
 * Empties up to `count` slots for a loss, once per `key` (a result can
 * re-render). Returns the emptied slots' positions, last filled first.
 */
export function takeFromEssenceSlots(count: number, key: string): number[] {
  if (consumedKeys.has(key)) {
    return [];
  }
  consumedKeys.add(key);
  const taken = Math.min(count, state.filled);
  const positions = Array.from({ length: taken }, (_, index) => slotPosition(state.filled - 1 - index));
  set({ ...state, filled: state.filled - taken });
  return positions;
}

/** Reserves the next free slot for an arriving essence; null when all five are taken. */
export function reserveEssenceSlot(): number | null {
  const used = state.filled + state.incoming;
  if (used >= ESSENCE_SLOT_COUNT) {
    return null;
  }
  set({ ...state, incoming: state.incoming + 1 });
  return slotPosition(used);
}

/** An essence reached its slot. */
export function landEssenceInSlot(): void {
  set({
    ...state,
    incoming: Math.max(0, state.incoming - 1),
    filled: Math.min(ESSENCE_SLOT_COUNT, state.filled + 1),
  });
}

/** The slot element on screen, for flights. */
export function essenceSlotElement(position: number): Element | null {
  return document.querySelector(`[data-essence-slot="${position}"]`);
}
