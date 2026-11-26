import { getExpansionById } from './gameData.js';

/**
 * Regional expansions (D-063): which encounters a new draw may give.
 *
 * Encounters held for review stay in the data but are never drawn, by the
 * random pool or by travel; one already on screen is never taken away. Empty
 * since 2026-11-26, when Babuni placed 20009 Grimnir Vault in Celesterra (1009).
 */
export const HELD_ENCOUNTER_IDS: ReadonlySet<number> = new Set<number>();

/**
 * A land is open when it is the base game or an active expansion. An inactive
 * catalog entry (a future region) is closed even to a player whose account
 * somehow lists it, so it cannot leak before its release is approved.
 */
export function isExpansionOpen(expansionId: number): boolean {
  return expansionId === 0 || getExpansionById(expansionId)?.mExtensioActive === true;
}
