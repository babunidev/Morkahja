/**
 * The dice slot's hidden pose is a left tilt, used before the die enters.
 * Hovering dice live inside that slot. Once any of them are up, the slot
 * stays upright, or the whole stack tips left when the rolls appear.
 */
export function motionForDiceSlot<T extends object>(
  revealStyle: T,
  stackVisible: boolean,
): T | { opacity: 1 } {
  if (stackVisible) {
    return { opacity: 1 };
  }

  return revealStyle;
}
