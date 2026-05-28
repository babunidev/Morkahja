/** Global outcome tier for every encounter roll channel. */
export type RollOutcome =
  | 'Misery'
  | 'Hardship'
  | 'Disengage'
  | 'Fortune'
  | 'Prosperity';

/**
 * Single global interpretation table (no slot-specific logic).
 * 1–10 Misery · 11–39 Hardship · 40–60 Disengage · 61–95 Fortune · 96–100 Prosperity
 */
export function interpretRoll(roll: number): RollOutcome | null {
  if (roll >= 1 && roll <= 10) {
    return 'Misery';
  }
  if (roll >= 11 && roll <= 39) {
    return 'Hardship';
  }
  if (roll >= 40 && roll <= 60) {
    return 'Disengage';
  }
  if (roll >= 61 && roll <= 95) {
    return 'Fortune';
  }
  if (roll >= 96 && roll <= 100) {
    return 'Prosperity';
  }
  return null;
}

/** Winning fate tiers for solution slots and dice override. */
export function isRollFavorable(roll: number): boolean {
  const outcome = interpretRoll(roll);
  return outcome === 'Fortune' || outcome === 'Prosperity';
}

/** Map a 1–100 roll to a 1–20 face for player-facing UI. */
export function displayRollAsD20(roll: number): number {
  return Math.min(20, Math.max(1, Math.round(roll / 5)));
}
