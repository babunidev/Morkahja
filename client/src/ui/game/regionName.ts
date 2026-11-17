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
