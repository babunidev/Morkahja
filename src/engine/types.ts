/** Numeric id for solutions, encounters, and other game entities. */
export type EntityId = number;

/** Key used in solution/encounter data JSON maps (stringified ids). */
export type DataKey = string;

/** Solution slot on the encounter UI (A = far left, D = far right). */
export type EncounterSlotLetter = 'A' | 'B' | 'C' | 'D';

export const ENCOUNTER_SLOTS: readonly EncounterSlotLetter[] = [
  'A',
  'B',
  'C',
  'D',
] as const;

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

/**
 * How many solution items the player loses on an unsuccessful attempt.
 * The multiplier is shown next to each solution in the UI.
 */
export type EncounterDifficulty = 1 | 2 | 3 | 4;

export const EncounterDifficulty = {
  /** Lose 1 solution item when unsuccessful. */
  One: 1,
  /** Lose 2 solution items when unsuccessful. */
  Two: 2,
  /** Lose 3 solution items when unsuccessful. */
  Three: 3,
  /** Lose 4 solution items when unsuccessful. */
  Four: 4,
} as const satisfies Record<string, EncounterDifficulty>;

/** Loss multiplier for a given encounter difficulty. */
export function encounterDifficultyLossMultiplier(
  difficulty: EncounterDifficulty,
): number {
  return difficulty;
}

/**
 * Encounter category; used for encounter-type achievements when continuing
 * after a successful solve.
 */
export type EncounterType = 1 | 2 | 3 | 4 | 5;

export const EncounterType = {
  Combat: 1,
  Trick: 2,
  Help: 3,
  Learn: 4,
  Trade: 5,
} as const satisfies Record<string, EncounterType>;

/**
 * Reward category when rolling rewards from the solution database (ludussolutio).
 * `mEncounterRewardAmount` controls how many rewards are granted.
 */
export type EncounterRewardType = 1 | 2 | 3 | 4;

export const EncounterRewardType = {
  Skills: 1,
  Items: 2,
  EpicItemsAndCurrency: 3,
  OtherItems: 4,
} as const satisfies Record<string, EncounterRewardType>;

/** `0` = available to all players; higher values require matching expansion unlock. */
export type EncounterExpansion = number;

/** `0` = next encounter chosen randomly; otherwise the follow-up encounter id. */
export type EncounterFollow = EntityId;

// ---------------------------------------------------------------------------
// Solution — inventory & rewards
// ---------------------------------------------------------------------------

export type SolutionInventoryType = 1 | 2 | 3;

/** Reward category on a solution record (skills, items, roles, races, etc.). */
export type SolutionRewardType =
  | 1
  | 2
  | 3
  | 4
  | 37
  | 38
  | 39
  | 40
  | 41
  | 42
  | 43;

export const SolutionRewardType = {
  Skills: 1,
  Items: 2,
  EpicItemsAndCurrency: 3,
  OtherItems: 4,
  Mage: 37,
  Warrior: 38,
  Rogue: 39,
  Rokur: 40,
  Verdani: 41,
  Aevis: 42,
  Grimnir: 43,
} as const satisfies Record<string, SolutionRewardType>;

// ---------------------------------------------------------------------------
// Solution — types (primary/secondary pairing: odd = skill, even = item)
// ---------------------------------------------------------------------------

export type SolutionType =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37
  | 38
  | 39
  | 40
  | 76
  | 77;

export const SolutionType = {
  // Learn
  LearnSkill: 1,
  LearnItem: 2,
  // Trade
  TradeSkill: 3,
  TradeItem: 4,
  // Find (trick)
  FindSkill: 5,
  FindItem: 6,
  // Unlock (trick)
  OpenLockSkill: 7,
  OpenLockItem: 8,
  // Combat — attack
  CombatSkill: 9,
  CombatItem: 10,
  // Climb (trick)
  ClimbSkill: 13,
  ClimbItem: 14,
  // Treasure / life / essence
  TreasureLifeItemEssence: 15,
  LifeSkill: 16,
  // Speak (trick)
  SpeechcraftSkill: 17,
  SpeechcraftItem: 18,
  // Heal (aid)
  HealSkill: 21,
  HealItem: 22,
  // Protect (aid)
  HelpSkill: 25,
  HelpItem: 26,
  // Purge (combat)
  PurgeSkill: 27,
  PurgeItem: 28,
  // Hunt (combat)
  HuntingSkill: 29,
  HuntingItem: 30,
  // Nurture (aid)
  NurtureSkill: 33,
  NurtureItem: 34,
  // Stealth (combat)
  StealthSkill: 35,
  StealthItem: 36,
  // Inspire (aid)
  InspirationSkill: 39,
  InspirationItem: 40,
  // Resurrection
  ResurrectionSkill: 76,
  ResurrectionItem: 77,
} as const satisfies Record<string, SolutionType>;

/** Base-skill solution ids referenced by type design. */
export const BaseSkillId = {
  Learn: 10001,
  Trade: 10002,
  Find: 10003,
  OpenLock: 10004,
  Combat: 10034,
  Heal: 10033,
  Help: 10072,
  Climb: 10070,
  Purge: 10078,
  Hunting: 10079,
  Nurture: 10076,
  Stealth: 10133,
  Speechcraft: 10129,
  Inspiration: 10146,
} as const satisfies Record<string, EntityId>;

// ---------------------------------------------------------------------------
// Raw data records (JSON field names preserved)
// ---------------------------------------------------------------------------

/** Solution (skill, tool, weapon, essence, etc.) from solutiondata.json. */
export interface SolutionData {
  mSolutionID: EntityId;
  mSolutionIconName: string;
  mSolutionInventoryType: SolutionInventoryType;
  mSolutionName: string;
  mSolutionRewardType: SolutionRewardType;
  mSolutionText: string;
  mSolutionType: SolutionType | number;
  /** Remaining uses / limitations for this solution in inventory context. */
  mSolutionUses: number;
}

/**
 * Encounter node from encountersdata.json.
 * Solution slots A–D each accept a primary solution id and/or a secondary
 * solution type fallback from the avatar inventory.
 */
export interface EncounterData {
  /**
   * On failure, the player loses this many solution items per slot.
   * Shown next to each solution in the UI.
   */
  mEncounterDifficulty: EncounterDifficulty;
  /**
   * Expansion gate: `0` is in every player's pool; encounters with expansion
   * `n` join the pool when the player has unlocked expansion `n` (cumulative).
   */
  mEncounterExpansion: EncounterExpansion;
  /**
   * Next encounter id after this one; `0` picks a random follow-up encounter.
   */
  mEncounterFollow: EncounterFollow;
  mEncounterID: EntityId;
  /** Image shown in the main content area. */
  mEncounterImageName: string;
  /** How many rewards are granted on success. */
  mEncounterRewardAmount: number;
  /** Reward category when rolling from ludussolutio. */
  mEncounterRewardType: EncounterRewardType;
  /**
   * Primary solution id for slot A (far left). `0` = none.
   * If inventory uses ≤ 0, shown at 50% opacity (unusable) or secondary applies.
   */
  mEncounterSolutiuonA: EntityId;
  /** Primary solution id for slot B (left of dice). `0` = empty slot. */
  mEncounterSolutiuonB: EntityId;
  /** Primary solution id for slot C (right of dice). `0` = empty slot. */
  mEncounterSolutiuonC: EntityId;
  /** Primary solution id for slot D (far right). `0` = empty slot. */
  mEncounterSolutiuonD: EntityId;
  /**
   * Secondary solution type for slot A when primary is unavailable.
   * `0` = none. Picks from avatar inventory by type; game auto-selects if multiple match.
   */
  mEncounterSolutiuonTypeA: SolutionType | number;
  mEncounterSolutiuonTypeB: SolutionType | number;
  mEncounterSolutiuonTypeC: SolutionType | number;
  mEncounterSolutiuonTypeD: SolutionType | number;
  /** Toggle: overlay text on top of the encounter image. */
  mEncounterText: string;
  /** Title displayed above the encounter image. */
  mEncounterTitle: string;
  /** Drives encounter-type achievements on continue after success. */
  mEncounterType: EncounterType;
}

export type SolutionDataMap = Record<DataKey, SolutionData>;
export type EncounterDataMap = Record<DataKey, EncounterData>;

// ---------------------------------------------------------------------------
// Parsed / runtime shapes
// ---------------------------------------------------------------------------

/** Primary id + secondary type for one encounter solution slot. */
export interface EncounterSlotRequirement {
  slot: EncounterSlotLetter;
  primarySolutionId: EntityId;
  secondarySolutionType: SolutionType | number;
}

/** Whether a slot shows a usable solution, a dimmed primary, or is empty. */
export type EncounterSlotDisplayState =
  | 'empty'
  | 'primary-usable'
  | 'primary-exhausted'
  | 'secondary-usable'
  | 'secondary-missing';

export interface EncounterSlotView {
  slot: EncounterSlotLetter;
  displayState: EncounterSlotDisplayState;
  /** Resolved solution id shown in the slot, if any. */
  solutionId: EntityId | null;
  /** Uses remaining on the displayed solution (`mSolutionUses` / limitations). */
  usesRemaining: number;
  /** Difficulty loss multiplier shown beside the solution. */
  lossOnFailure: number;
}

/** Parsed solution requirements for an encounter (non-zero primary or secondary). */
export interface EncounterRequirements {
  encounterId: EntityId;
  slots: EncounterSlotRequirement[];
}

/** Extract slot A–D requirements from raw encounter data. */
export function parseEncounterSlots(
  encounter: EncounterData,
): EncounterSlotRequirement[] {
  const pairs: Array<{
    slot: EncounterSlotLetter;
    primary: EntityId;
    secondary: number;
  }> = [
    {
      slot: 'A',
      primary: encounter.mEncounterSolutiuonA,
      secondary: encounter.mEncounterSolutiuonTypeA,
    },
    {
      slot: 'B',
      primary: encounter.mEncounterSolutiuonB,
      secondary: encounter.mEncounterSolutiuonTypeB,
    },
    {
      slot: 'C',
      primary: encounter.mEncounterSolutiuonC,
      secondary: encounter.mEncounterSolutiuonTypeC,
    },
    {
      slot: 'D',
      primary: encounter.mEncounterSolutiuonD,
      secondary: encounter.mEncounterSolutiuonTypeD,
    },
  ];

  return pairs
    .filter(({ primary, secondary }) => primary !== 0 || secondary !== 0)
    .map(({ slot, primary, secondary }) => ({
      slot,
      primarySolutionId: primary,
      secondarySolutionType: secondary,
    }));
}

/**
 * Encounters available to a player given their unlocked expansion level.
 * Expansion `0` is always included; unlock `n` adds all encounters ≤ `n`.
 */
export function isEncounterInPool(
  encounter: EncounterData,
  unlockedExpansion: number,
): boolean {
  return encounter.mEncounterExpansion <= unlockedExpansion;
}
