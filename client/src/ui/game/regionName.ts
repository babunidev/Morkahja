import { expansionFromEncounterMap } from '../music/encounterExpansion.js';

/** The base game's land (Babuni, 2026-11-17); it has no entry in the expansion catalog. */
export const BASE_REGION_NAME = "Ethera's Vale";

const SMALL_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'in', 'on', 'to']);

/** Title case for a catalog name: "The cursed forest of Keldor" → "The Cursed Forest of Keldor". */
export function regionTitleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word.toLowerCase())
      ? word.toLowerCase()
      : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** The name of the region an encounter belongs to, or null if it can't be told. */
export function regionNameFor(
  encounters: Record<string, unknown>,
  expansions: Record<string, unknown>,
  encounterId: number,
): string | null {
  const expansion = expansionFromEncounterMap(encounters, encounterId);
  if (expansion == null) {
    return null;
  }
  if (expansion === 0) {
    return BASE_REGION_NAME;
  }
  const record = expansions[String(expansion)];
  const name = record && typeof record === 'object'
    ? (record as { mExtensioName?: unknown }).mExtensioName
    : undefined;
  return typeof name === 'string' && name.trim() ? regionTitleCase(name) : null;
}

/** Atranor is a realm of its own, not a land on the map; the level-up happens wherever the player already is. */
export const ATRANOR_ENCOUNTER_ID = 1;
export const ATRANOR_REGION_NAME = 'Atranor';

/**
 * The land shown on the encounter plate (Babuni, 2026-11-17): the encounter's
 * own place from the placement list, so a base-game story set in Karrhu says
 * "Swamp of Karrhu". Undefined means "keep the land already shown" (the
 * level-up). Encounters missing from the list fall back to their expansion.
 */
export function plateLabelFor(
  encounterId: number,
  locations: Readonly<Record<number, { label: string } | null>>,
  encounters: Record<string, unknown>,
  expansions: Record<string, unknown>,
): string | null | undefined {
  if (encounterId === ATRANOR_ENCOUNTER_ID) {
    return ATRANOR_REGION_NAME;
  }
  if (encounterId in locations) {
    const place = locations[encounterId];
    return place ? place.label : undefined;
  }
  return regionNameFor(encounters, expansions, encounterId);
}
