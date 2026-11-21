/**
 * Which frame a solution picture gets (Babuni's direction, 2026-11-21): the
 * remade solution pictures come without a painted frame, and the game draws
 * one around them, in the encounter frame's language made round
 * (SolutionFrame.tsx).
 *
 * - `standard`: skills and simple items.
 * - `essence`: a god's essence (solution type 15), with corner pieces showing
 *   the god's element.
 * - `rare`: valuable items, with an ornamental ring around the standard frame.
 *
 * Every solution picture gets the drawn frame on top (Babuni, 2026-11-21: the
 * frame is part of the UI, not of the picture). Pictures not yet remade still
 * have a frame painted in; they are zoomed so that the painted rim falls outside
 * the drawn frame's circle. Add an icon name to FRAMELESS_SOLUTION_ICONS when its
 * remade, frameless picture replaces the old file, so it is shown whole.
 */
export const FRAMELESS_SOLUTION_ICONS: ReadonlySet<string> = new Set([
  'skill_learn',
  'skill_buy',
  'skill_lockpick',
  'skill_search',
  '10247_pouch',
  'tool_map_enchanted_glades',
  'tool_map_fae_pastures',
  '10246_jar',
]);

export type SolutionFrameTier = 'standard' | 'essence' | 'rare';
export type SolutionElement = 'fire' | 'water' | 'air' | 'earth';

export interface SolutionFrameLook {
  tier: SolutionFrameTier;
  element: SolutionElement | null;
}

/**
 * How far an older picture is zoomed inside the drawn frame, so its painted
 * laurel rim (about a fifth of the radius) is cut away and only the inside shows.
 */
export const PAINTED_FRAME_ZOOM = 1.3;

/** The zoom for a picture: 1 for a remade, frameless one. */
export function solutionPictureZoom(iconName: string): number {
  return FRAMELESS_SOLUTION_ICONS.has(iconName) ? 1 : PAINTED_FRAME_ZOOM;
}

export interface SolutionFrameRecord {
  mSolutionID: number;
  mSolutionIconName: string;
  mSolutionInventoryType: number;
  mSolutionType: number;
}

/**
 * The gods' essences by solution id, grouped by tribunal (MorkahjaWorldBuilding
 * Pantheon/Elemental_Pantheon.md): Ignis Council fire, Abyssal Conclave water,
 * Celestial Convocation air, Terran Assembly earth.
 */
export const ESSENCE_ELEMENTS: Readonly<Record<number, SolutionElement>> = {
  10040: 'fire', // Fyraan
  10038: 'fire', // Solriel
  10039: 'fire', // Khaotys
  10122: 'water', // Nereval
  10123: 'water', // Sylvanus
  10244: 'water', // Aerisara
  10010: 'air', // Aeriel
  10011: 'air', // Aetheria
  10026: 'air', // Ordius
  10037: 'earth', // Stonara
  10027: 'earth', // Ferrumis
  10036: 'earth', // Umbrael
};

const ESSENCE_SOLUTION_TYPE = 15;
const ESSENCE_INVENTORY_TYPE = 3;
/** The Atranor items. */
const EPIC_SOLUTION_TYPE = 77;

/**
 * The frame for a solution record. Rare (a proposal until Babuni confirms it):
 * the Atranor items, anything else kept in the essence inventory that is not an
 * essence (the Frostbane Glaive, the Zephyrstring Lyre), and icons named
 * legendary or epic.
 */
export function solutionFrameLookFor(record: SolutionFrameRecord): SolutionFrameLook {
  if (record.mSolutionType === ESSENCE_SOLUTION_TYPE) {
    return { tier: 'essence', element: ESSENCE_ELEMENTS[record.mSolutionID] ?? null };
  }
  const icon = record.mSolutionIconName.toLowerCase();
  if (
    record.mSolutionType === EPIC_SOLUTION_TYPE
    || record.mSolutionInventoryType === ESSENCE_INVENTORY_TYPE
    || icon.includes('legendary')
    || icon.includes('_epic_')
  ) {
    return { tier: 'rare', element: null };
  }
  return { tier: 'standard', element: null };
}

/** `skill_learn` from `/…/solutionimages/skill_learn.webp`, else null. */
export function solutionIconNameFromSrc(src: string): string | null {
  const match = /\/solutionimages\/([^/?#]+)\.webp(?:[?#].*)?$/.exec(src);
  return match ? decodeURIComponent(match[1]!) : null;
}
