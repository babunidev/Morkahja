import { getExpansionById } from './gameData.js';

/**
 * Regional expansions (D-063): which encounters a new draw may give.
 *
 * Encounters held for review stay in the data but are never drawn, by the
 * random pool or by travel: 20009 Grimnir Vault lies in Deepstone Hollow, near
 * Everwinter Valley but not clearly inside it, so it is not given to the
 * active Everwinter expansion (1003) without Babuni's boundary and entitlement
 * review. An encounter already on screen is never taken away.
 */
export const HELD_ENCOUNTER_IDS: ReadonlySet<number> = new Set([20009]);

/**
 * A land is open when it is the base game or an active expansion. An inactive
 * catalog entry (a future region) is closed even to a player whose account
 * somehow lists it, so it cannot leak before its release is approved.
 */
export function isExpansionOpen(expansionId: number): boolean {
  return expansionId === 0 || getExpansionById(expansionId)?.mExtensioActive === true;
}
