/**
 * Edit avatar (D-056, Babuni, 2026-11-23): in the main menu an avatar can get
 * a new portrait of the same race, role and gender, a new frame and a new
 * name. Race, role and gender stay. Only what changes is paid: the new
 * portrait's gems (`avatarGems`), the new frame's gems (`frameGem`) and
 * 50 gems for a new name.
 */
export const AVATAR_RENAME_GEM_COST = 50;
export const AVATAR_NAME_MAX_LENGTH = 32;

export interface AvatarEditPrices {
  /** The new portrait's `avatarGems`, when the portrait changes. */
  portraitGems: number | null;
  /** The new frame's `frameGem`, when the frame changes. */
  frameGems: number | null;
  nameChanged: boolean;
}

export function avatarEditCost({ portraitGems, frameGems, nameChanged }: AvatarEditPrices): number {
  const price = (gems: number | null): number => (gems === null ? 0 : Math.max(0, Math.floor(gems)));
  return price(portraitGems) + price(frameGems) + (nameChanged ? AVATAR_RENAME_GEM_COST : 0);
}

/** `avatar_123.webp` → 123; null when it is not a portrait file name. */
export function portraitIdFromFile(file: string | null | undefined): number | null {
  const match = /^avatar_(\d+)\.webp$/.exec(file ?? '');
  return match ? Number(match[1]) : null;
}

/** `frame_12.webp` → 12; null when it is not a frame file name. */
export function frameIdFromFile(file: string | null | undefined): number | null {
  const match = /^frame_(\d+)\.webp$/.exec(file ?? '');
  return match ? Number(match[1]) : null;
}

/** A name as it is saved: trimmed, at most 32 characters; empty when there is none. */
export function normalizeAvatarName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, AVATAR_NAME_MAX_LENGTH);
}

/** The portrait data's race and role ids (`avatarRace`, `avatarRole`). */
export const PORTRAIT_RACE_IDS: Readonly<Record<string, number>> = { Grimnir: 1, Verdani: 2, Aevis: 3, Rokur: 4 };
export const PORTRAIT_ROLE_IDS: Readonly<Record<string, number>> = { Mage: 1, Rogue: 2, Warrior: 3 };
