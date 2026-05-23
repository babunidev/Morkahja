/** Matches client LoreBlock timing so UI and server stay aligned. */
export const LORE_GEM_MIN_MS = 14_000;
export const LORE_GEM_MAX_MS = 28_000;
export const LORE_GEM_REVEAL_CHANCE = 1;

export function rollLoreGemClaimableAt(
  nowMs: number,
  random: () => number = Math.random,
): { eligible: boolean; claimableAt: number | null } {
  if (random() > LORE_GEM_REVEAL_CHANCE) {
    return { eligible: false, claimableAt: null };
  }

  const delayMs = Math.floor(
    LORE_GEM_MIN_MS + random() * (LORE_GEM_MAX_MS - LORE_GEM_MIN_MS + 1),
  );

  return { eligible: true, claimableAt: nowMs + delayMs };
}
