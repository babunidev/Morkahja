/** Matches client LoreBlock timing so UI and server stay aligned. */
export const LORE_GEM_MIN_MS = 14_000;
export const LORE_GEM_MAX_MS = 28_000;
export const LORE_GEM_REVEAL_CHANCE = 1;

export function rollLoreGemDurationMs(random: () => number = Math.random): number {
  return Math.floor(
    LORE_GEM_MIN_MS + random() * (LORE_GEM_MAX_MS - LORE_GEM_MIN_MS + 1),
  );
}

export function rollLoreGemClaimableAt(
  nowMs: number,
  random: () => number = Math.random,
): { eligible: boolean; claimableAt: number | null; durationMs: number } {
  if (random() > LORE_GEM_REVEAL_CHANCE) {
    return { eligible: false, claimableAt: null, durationMs: 0 };
  }

  const durationMs = rollLoreGemDurationMs(random);

  return { eligible: true, claimableAt: nowMs + durationMs, durationMs };
}
