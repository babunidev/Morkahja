/**
 * Travel (D-056, Babuni, 2026-11-23): on the world map the player pays gems to
 * go to a region they have. A region is its expansion, not where an encounter
 * sits on the map: every land of the base game (expansion 0) is the same
 * destination. A trip costs a tenth of the expansion's gem price, rounded, and
 * 1 gem for the base game. The current encounter is swapped for a random one
 * of the destination; the one left gives no reward and no loss.
 */
export const BASE_GAME_EXPANSION = 0;
export const BASE_GAME_TRAVEL_GEMS = 1;

/** What a trip costs, from the expansion's unlock price in gems. */
export function travelCost(expansionId: number, expansionGemPrice: number | null | undefined): number {
  if (expansionId === BASE_GAME_EXPANSION) {
    return BASE_GAME_TRAVEL_GEMS;
  }
  return Math.max(1, Math.round(Math.max(0, expansionGemPrice ?? 0) / 10));
}
