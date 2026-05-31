export const DICE_UI_ROOT = '/UI/09_GAME/DIE';

export const DICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export type DiceId = (typeof DICE_IDS)[number];

export const DEFAULT_DICE_ID: DiceId = 'a';

export const DEFAULT_UNLOCKED_DICE_IDS: DiceId[] = [DEFAULT_DICE_ID];

export const DICE_UNLOCK_GEM_COST = 100;

/** Real-money price (EUR, in cents) to unlock any single dice skin. */
export const DICE_UNLOCK_EUR_CENTS = 149;

export function isDiceId(value: unknown): value is DiceId {
  return typeof value === 'string' && (DICE_IDS as readonly string[]).includes(value);
}

export function diceButtonAssetPath(diceId: DiceId): string {
  return `${DICE_UI_ROOT}/im_button_dice_${diceId}.webp`;
}

export function normalizeUnlockedDiceIds(value: unknown): DiceId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_UNLOCKED_DICE_IDS];
  }

  const unlocked = value.filter(isDiceId);

  if (!unlocked.includes(DEFAULT_DICE_ID)) {
    unlocked.unshift(DEFAULT_DICE_ID);
  }

  return [...new Set(unlocked)].sort(
    (left, right) => DICE_IDS.indexOf(left) - DICE_IDS.indexOf(right),
  );
}

export function normalizeSelectedDiceId(
  value: unknown,
  unlockedDiceIds: DiceId[],
): DiceId {
  if (isDiceId(value) && unlockedDiceIds.includes(value)) {
    return value;
  }

  return DEFAULT_DICE_ID;
}

const DICE_NAMES: Record<DiceId, string> = {
  a: 'Frostchalk',
  b: 'Urbronze',
  c: 'Ashmaw',
  d: 'Grimroot',
  e: 'Wellwater',
  f: 'Cloudbone',
};

export function diceDisplayName(diceId: DiceId): string {
  return DICE_NAMES[diceId];
}

export interface DiceCatalogEntry {
  id: DiceId;
  label: string;
  assetPath: string;
  gemUnlockCost: number;
  eurUnlockCents: number;
}

export const DICE_CATALOG: DiceCatalogEntry[] = DICE_IDS.map((id) => ({
  id,
  label: DICE_NAMES[id],
  assetPath: diceButtonAssetPath(id),
  gemUnlockCost: id === DEFAULT_DICE_ID ? 0 : DICE_UNLOCK_GEM_COST,
  eurUnlockCents: id === DEFAULT_DICE_ID ? 0 : DICE_UNLOCK_EUR_CENTS,
}));
