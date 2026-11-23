/**
 * Encounter Generator Service — the ONLY authority for encounter creation,
 * snapshot persistence, and resolution orchestration.
 *
 * Client must NOT call selection, roll generation, or validation.
 * Client sends actions only; server owns all fate via persisted snapshots.
 */
import { generateEncounterRollSnapshot } from '../engine/encounterRollGenerator.js';
import { resolveEncounter as runDeterministicResolver } from '../engine/encounterResolver.js';
import type { EncounterResolution } from '../engine/encounterResolver.js';
import { interpretRoll, isD20Face, type RollOutcome } from '../engine/diceInterpreter.js';
import {
  applyPendingLevelUpRewardsFlag,
  createInitialProgression,
} from '../domain/avatar/AvatarProgression.js';
import { ownElementEssenceBonus } from '../engine/ownElementEssenceBonus.js';
import {
  RACE_REWARD_TYPE_ELEMENTS,
  essenceIdsOfElement,
  type EssenceElement,
} from '@shared/essenceElements.js';
import { type EncounterData, type EncounterDataMap } from '../engine/types.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { AvatarInventory } from '../types/avatar.js';
import { applyFailedDeathState } from './avatarDeathService.js';
import {
  withDocumentTransaction,
  type DocumentTransaction,
} from '../db/postgresDocumentStore.js';
import type {
  EncounterSnapshot,
  PreparedEncounter,
  PlayerEncounterAction,
} from '../types/encounterSnapshot.js';
import {
  encounterToSnapshotFields,
  snapshotToEncounterData,
  snapshotToRolls,
  toSelectedEncounterAction,
} from '../types/encounterSnapshot.js';
import { getEncounterById, getEncounters, getSolutionMap } from './gameData.js';
import {
  claimActiveEncounterInTransaction,
  loadActiveEncounter,
  loadAvatar,
  saveActiveEncounter,
  saveAvatar,
} from './encounterPersistence.js';
import {
  applyProgressionForEncounter,
  initializeAvatarProgression,
  progressionExists,
} from './avatarProgressionService.js';
import { experienceForSelectedRollOutcome } from '../domain/avatar/AvatarProgression.js';
import {
  addRewardToInventoryState,
  applyEncounterInventoryChanges,
  consumeSolutionFromInventoryState,
  createInitialAvatarInventory,
  flattenInventorySolutionIds,
  initializeAvatarInventory,
  inventoryExists,
  scaledUses,
} from './inventoryService.js';
import {
  migrateAvatarUnlockedExpansionsToPlayer,
} from './playerService.js';
import {
  recordEncounterContinuedEvents,
  type EncounterContinuedEventContext,
} from './gameEventService.js';
import type { RoomEncounterLineage } from '../domain/rooms/RoomSystemEvent.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID as ROOM_LEVEL_UP_ID } from '../domain/rooms/RoomSystemEvent.js';
import type {
  ParticipantPreparedResult,
  PreparedCommitBundle,
} from '../domain/rooms/RoomParticipant.js';

const RANDOM_ENCOUNTER_MIN_ID = 20001;
/** A d20 of 1–14 stays in the current expansion. 15–20 leaves it. */
const SAME_EXPANSION_STAY_MAX = 14;
/** Must match client action unlock timing: reveal delay + fade-in. */
export const ENCOUNTER_ACTION_ENABLE_DELAY_MS = 3_280;
/** Atranor death encounter (mEncounterID 1) — queued when essence is depleted. */
export const DEATH_ENCOUNTER_ID = '00001';
export const LEVEL_UP_ENCOUNTER_ID = '00002';
const DEATH_ENCOUNTER_NUMERIC_ID = Number(DEATH_ENCOUNTER_ID);
const LEVEL_UP_ENCOUNTER_NUMERIC_ID = Number(LEVEL_UP_ENCOUNTER_ID);

// Atranor (encounter id 1) = DEATH_ENCOUNTER_ID: queued after essence depletion on a normal encounter.
// Random pool still starts at 20001. avatarDied is true only after Atranor Misery/Hardship — not when
// deathTriggered queues Atranor. Client must not infer death locally.

export interface EncounterSelectionContext {
  unlockedExpansions: number[];
  previousEncounter?: EncounterData | null;
  /**
   * Expansion just left. `null` keeps a fair draw across the whole pool.
   * Omitted uses the previous encounter's expansion when there is no written follow.
   */
  currentExpansion?: number | null;
  /** Inclusive integer draw. Tests pass a fixed sequence. */
  nextInt?: (min: number, max: number) => number;
  /** Encounters played most recently: not drawn while others are available. */
  avoidEncounterIds?: readonly number[];
}

/**
 * An encounter waits for at least this many others before it can be drawn
 * again: after X come three different encounters, and X may return fourth
 * at the earliest (Babuni, 2026-11-17). Written follows, Atranor and the
 * level-up are not draws and are exempt.
 */
export const ENCOUNTER_REPEAT_GAP = 3;

/** The recent list after `encounterId` was played (random encounters only). */
export function recentAfter(recent: readonly number[] | undefined, encounterId: number | undefined): number[] {
  const list = [...(recent ?? [])];
  if (typeof encounterId === 'number' && encounterId >= RANDOM_ENCOUNTER_MIN_ID && !isSystemEncounterId(encounterId)) {
    list.push(encounterId);
  }
  return list.slice(-ENCOUNTER_REPEAT_GAP);
}

export interface ResolveEncounterResult {
  snapshot: EncounterSnapshot;
  resolution: EncounterResolution;
}

export interface ContinueEncounterResult {
  avatar: AvatarDocument;
  snapshot: EncounterSnapshot;
  resolution: EncounterResolution;
  deathTriggered: boolean;
  avatarDied: boolean;
}

/** Inclusive integer in [min, max]. Server-only randomness at creation time. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isEncounterAllowed(
  encounter: EncounterData,
  unlockedExpansions: number[],
): boolean {
  if (encounter.mEncounterExpansion === 0) {
    return true;
  }
  return unlockedExpansions.includes(encounter.mEncounterExpansion);
}

function isSystemEncounterId(encounterId: number): boolean {
  return (
    encounterId === DEATH_ENCOUNTER_NUMERIC_ID ||
    encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
  );
}

function buildRandomPool(
  encounters: EncounterDataMap,
  unlockedExpansions: number[],
): EncounterData[] {
  return Object.values(encounters).filter(
    (encounter) =>
      encounter.mEncounterID >= RANDOM_ENCOUNTER_MIN_ID &&
      !isSystemEncounterId(encounter.mEncounterID) &&
      isEncounterAllowed(encounter, unlockedExpansions),
  );
}

function findEncounter(
  encounters: EncounterDataMap,
  encounterId: number,
): EncounterData | undefined {
  return Object.values(encounters).find((encounter) => encounter.mEncounterID === encounterId);
}

function selectionRegion(context: EncounterSelectionContext): number | null {
  if (context.currentExpansion !== undefined) {
    return context.currentExpansion;
  }
  return context.previousEncounter?.mEncounterExpansion ?? null;
}

/**
 * Fair draw inside the pool the region roll chose.
 * A written follow is handled before this runs.
 */
function drawFromRegionPool(
  allowed: EncounterData[],
  currentExpansion: number | null,
  nextInt: (min: number, max: number) => number,
  avoid: readonly number[] = [],
): EncounterData {
  // Recently played encounters sit out while anything else is left to draw.
  const fresh = allowed.filter((encounter) => !avoid.includes(encounter.mEncounterID));
  const pool = fresh.length > 0 ? fresh : allowed;
  let candidates = pool;

  if (currentExpansion !== null) {
    const same = pool.filter((encounter) => encounter.mEncounterExpansion === currentExpansion);
    const other = pool.filter((encounter) => encounter.mEncounterExpansion !== currentExpansion);
    const stay = nextInt(1, 20) <= SAME_EXPANSION_STAY_MAX;
    if (stay && same.length > 0) {
      candidates = same;
    } else if (!stay && other.length > 0) {
      candidates = other;
    } else if (same.length > 0) {
      candidates = same;
    } else {
      candidates = other;
    }
  }

  return candidates[nextInt(0, candidates.length - 1)]!;
}

/**
 * Select next encounter: forced follow (hard override) or random pool.
 * Loads static data from game/encountersdata.json via gameData service.
 */
export function selectNextEncounter(
  context: EncounterSelectionContext,
  encounters: EncounterDataMap = getEncounters(),
): EncounterData {
  const previous = context.previousEncounter;

  if (previous && previous.mEncounterFollow > 0) {
    const followUp = findEncounter(encounters, previous.mEncounterFollow)
      ?? getEncounterById(previous.mEncounterFollow);
    if (!followUp) {
      throw new Error(
        `Follow encounter not found: ${previous.mEncounterFollow}`,
      );
    }
    return followUp;
  }

  const pool = buildRandomPool(encounters, context.unlockedExpansions);

  if (pool.length === 0) {
    throw new Error('No eligible random encounters for avatar expansions');
  }

  return drawFromRegionPool(pool, selectionRegion(context), context.nextInt ?? randomInt, context.avoidEncounterIds);
}

export function prepareNextEncounter(
  currentEncounter: EncounterData,
  unlockedExpansions: number[],
  encounters: EncounterDataMap = getEncounters(),
): PreparedEncounter {
  const randomEncounter = selectNextEncounter({
    unlockedExpansions,
    currentExpansion: currentEncounter.mEncounterExpansion,
  }, encounters);

  return {
    encounterId: randomEncounter.mEncounterID,
    followMode: 'random',
  };
}

export function preparedSystemEncounter(encounterId: number): PreparedEncounter {
  const encounter = getEncounterById(encounterId);

  if (!encounter) {
    throw new Error(`System encounter not found: ${encounterId}`);
  }

  getSolutionMap();
  return {
    encounterId,
    followMode: 'system',
  };
}

export function generateSnapshotRolls(difficulty: number): Pick<
  EncounterSnapshot,
  | 'rollA'
  | 'rollB'
  | 'rollC'
  | 'rollD'
  | 'rollPrimaryA'
  | 'rollPrimaryB'
  | 'rollPrimaryC'
  | 'rollPrimaryD'
  | 'rollSecondaryA'
  | 'rollSecondaryB'
  | 'rollSecondaryC'
  | 'rollSecondaryD'
  | 'rollE'
  | 'extraRolls'
  | 'diceFillRolls'
> {
  return generateEncounterRollSnapshot(difficulty);
}

const STORED_ROLL_KEYS = [
  'rollA',
  'rollB',
  'rollC',
  'rollD',
  'rollPrimaryA',
  'rollPrimaryB',
  'rollPrimaryC',
  'rollPrimaryD',
  'rollSecondaryA',
  'rollSecondaryB',
  'rollSecondaryC',
  'rollSecondaryD',
  'rollE',
] as const satisfies readonly (keyof EncounterSnapshot)[];

function storedRollIsLegacy(value: unknown): boolean {
  return typeof value === 'number' && !isD20Face(value);
}

/**
 * True when a stored lane still uses the retired 1–100 scale.
 * A snapshot marked `rollTotals` already stores the uncapped total, so a 27 stays.
 */
export function snapshotHasLegacyPercentRoll(snapshot: EncounterSnapshot): boolean {
  if (snapshot.rollTotals) {
    return false;
  }

  if (STORED_ROLL_KEYS.some((key) => storedRollIsLegacy(snapshot[key]))) {
    return true;
  }

  const extras = snapshot.extraRolls;
  if (!extras) {
    return false;
  }

  return (['primary', 'secondary'] as const).some((lane) =>
    (['A', 'B', 'C', 'D'] as const).some((slot) =>
      extras[lane][slot].some((roll) => storedRollIsLegacy(roll)),
    ),
  );
}

/**
 * Unresolved encounters created before the d20 table keep secret 1–100 numbers.
 * Replace those faces before the choice is resolved. Level-up rewards were
 * chosen from the old die, so they are cleared and drawn again from the new face.
 */
export function replaceLegacyPercentRolls<T extends EncounterSnapshot>(snapshot: T): T {
  if (!snapshotHasLegacyPercentRoll(snapshot)) {
    return snapshot;
  }

  const rolls = generateSnapshotRolls(snapshot.encounterDifficulty);
  const isLevelUp = snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID;
  const rewardIds = isLevelUp ? [] : snapshot.rewardIds;

  return {
    ...snapshot,
    ...rolls,
    rewardIds,
    ...(isLevelUp ? { levelUpChoiceIds: undefined } : {}),
    rollTotals: true,
  };
}

export function randomRewardsForEncounter(
  encounter: EncounterData,
  excludeRewardIds: ReadonlySet<number> = new Set(),
): number[] {
  const amount = Math.max(0, encounter.mEncounterRewardAmount);

  if (amount === 0) {
    return [];
  }

  const candidates = Object.values(getSolutionMap()).filter(
    (solution) => solution.mSolutionRewardType === encounter.mEncounterRewardType,
  );

  if (candidates.length === 0) {
    return [];
  }

  const rewards: number[] = [];
  const claimed = new Set(excludeRewardIds);

  for (let index = 0; index < amount; index += 1) {
    let pool = candidates.filter(
      (solution) => !claimed.has(solution.mSolutionID),
    );
    if (pool.length === 0) {
      pool = [...candidates];
    }

    const rewardIndex = randomInt(0, pool.length - 1);
    const reward = pool[rewardIndex]!;
    rewards.push(reward.mSolutionID);
    claimed.add(reward.mSolutionID);
  }

  return rewards;
}

export function buildEncounterSnapshot(
  playerId: string,
  avatarId: string,
  encounter: EncounterData,
  preparedEncounter: PreparedEncounter,
  avatar?: AvatarDocument,
): EncounterSnapshot {
  const createdAt = Date.now();
  const rolls = generateSnapshotRolls(encounter.mEncounterDifficulty);
  const isLevelUp = encounter.mEncounterID === LEVEL_UP_ENCOUNTER_NUMERIC_ID;
  const rewardIds = isLevelUp
    ? levelUpRewardIdsForSnapshot(avatar, rolls.rollE)
    : randomRewardsForEncounter(encounter);

  return {
    ...(isLevelUp ? { levelUpChoiceIds: levelUpChoiceIdsForAvatar(avatar, rewardIds) } : {}),
    snapshotId: crypto.randomUUID(),
    playerId,
    avatarId,
    encounterId: encounter.mEncounterID,
    ...encounterToSnapshotFields(encounter),
    ...rolls,
    rollTotals: true,
    rewardIds,
    prosperityRewardId: randomEssenceReward(),
    resolved: false,
    state: 'created',
    createdAt,
    actionReadyAt: createdAt + ENCOUNTER_ACTION_ENABLE_DELAY_MS,
    preparedEncounter,
  };
}

export function withPrecomputedSnapshotRewards(
  snapshot: EncounterSnapshot,
  avatar?: AvatarDocument,
): EncounterSnapshot {
  const hasRewardIds = Array.isArray(snapshot.rewardIds);
  const hasProsperityReward = 'prosperityRewardId' in snapshot;

  const needsLevelUpChoices = snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
    && snapshot.levelUpChoiceIds === undefined
    && avatar !== undefined;
  if (hasRewardIds && hasProsperityReward && !needsLevelUpChoices) {
    return snapshot;
  }

  const encounter = snapshotToEncounterData(snapshot);
  const rewardIds = snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
    ? (
      hasRewardIds && Array.isArray(snapshot.rewardIds) && snapshot.rewardIds.length > 0
        ? snapshot.rewardIds
        : levelUpRewardIdsForSnapshot(avatar, snapshot.rollE)
    )
    : randomRewardsForEncounter(encounter);

  return {
    ...snapshot,
    ...(snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID && snapshot.levelUpChoiceIds === undefined
      ? { levelUpChoiceIds: levelUpChoiceIdsForAvatar(avatar, rewardIds) }
      : {}),
    rewardIds: hasRewardIds && snapshot.encounterId !== LEVEL_UP_ENCOUNTER_NUMERIC_ID
      ? snapshot.rewardIds
      : rewardIds,
    prosperityRewardId: hasProsperityReward
      ? snapshot.prosperityRewardId
      : randomEssenceReward(),
  };
}

function getPreparedEncounter(snapshot: EncounterSnapshot): EncounterData {
  if (!snapshot.preparedEncounter) {
    throw new Error(`Snapshot missing prepared encounter: ${snapshot.snapshotId}`);
  }

  const encounter = getEncounterById(snapshot.preparedEncounter.encounterId);

  if (!encounter) {
    throw new Error(
      `Prepared encounter not found: ${snapshot.preparedEncounter.encounterId}`,
    );
  }

  return encounter;
}

function isFollowOutcome(outcome: ReturnType<typeof interpretRoll>): boolean {
  return outcome === 'Fortune' || outcome === 'Prosperity';
}

export interface OutcomeSummaryForFollow {
  success: boolean;
  selectedRoll?: number;
}

/** Whether the room should use the configured follow encounter (slot-0 / lineage rules). */
export function shouldUseEncounterFollow(
  encounterFollow: number,
  summary: OutcomeSummaryForFollow | undefined,
): boolean {
  if (encounterFollow <= 0 || !summary?.success) {
    return false;
  }

  if (summary.selectedRoll === undefined) {
    return false;
  }

  return isFollowOutcome(interpretRoll(summary.selectedRoll));
}

function getNextEncounterAfterResolution(
  snapshot: EncounterSnapshot,
  selectedRollOutcome: RollOutcome | null,
  unlockedExpansions: number[],
): EncounterData {
  if (snapshot.preparedEncounter?.followMode === 'system') {
    return getPreparedEncounter(snapshot);
  }

  if (
    snapshot.encounterFollow > 0 &&
    isFollowOutcome(selectedRollOutcome)
  ) {
    const followEncounter = getEncounterById(snapshot.encounterFollow);

    if (!followEncounter) {
      throw new Error(`Follow encounter not found: ${snapshot.encounterFollow}`);
    }

    return followEncounter;
  }

  return selectNextEncounter({
    unlockedExpansions,
    currentExpansion: snapshot.encounterExpansion,
  }, getEncounters());
}

/** Next encounter after witnessed system events complete — uses origin lineage, not system snapshot. */
export function resolveNextEncounterForRoom(
  lineage: RoomEncounterLineage,
  mergedExpansions: number[],
  avoidEncounterIds: readonly number[] = [],
): { encounter: EncounterData; prepared: PreparedEncounter } {
  if (lineage.preparedEncounter?.followMode === 'system') {
    const encounter = getEncounterById(lineage.preparedEncounter.encounterId);
    if (!encounter) {
      throw new Error(
        `Prepared system encounter not found: ${lineage.preparedEncounter.encounterId}`,
      );
    }
    const prepared = prepareNextEncounter(encounter, mergedExpansions);
    return { encounter, prepared };
  }

  if (
    lineage.originEncounterFollow > 0 &&
    lineage.originSuccess &&
    isFollowOutcome(lineage.originRollOutcome)
  ) {
    const followEncounter = getEncounterById(lineage.originEncounterFollow);
    if (!followEncounter) {
      throw new Error(`Follow encounter not found: ${lineage.originEncounterFollow}`);
    }
    return {
      encounter: followEncounter,
      prepared: prepareNextEncounter(followEncounter, mergedExpansions),
    };
  }

  const origin = getEncounterById(lineage.originEncounterId);
  const encounter = selectNextEncounter({
    unlockedExpansions: mergedExpansions,
    currentExpansion: origin?.mEncounterExpansion ?? null,
    avoidEncounterIds,
  }, getEncounters());
  return {
    encounter,
    prepared: prepareNextEncounter(encounter, mergedExpansions),
  };
}

export function buildLineagePreparedEncounter(
  deathTriggered: boolean,
  leveledUp: boolean,
): PreparedEncounter | undefined {
  if (deathTriggered && leveledUp) {
    return preparedSystemEncounter(ROOM_LEVEL_UP_ID);
  }
  return undefined;
}

function currentEssence(inventory: AvatarInventory): number {
  return inventory.essences
    .filter((item) => item.solutionType === 15)
    .reduce((total, item) => total + item.uses, 0);
}

function shouldQueueDeathEncounterAfterFailure(
  success: boolean,
  encounterId: number,
  selectedRollOutcome: RollOutcome | null,
  encounterDifficulty: number,
  inventoryAfterPenalty: AvatarInventory,
): boolean {
  if (
    success ||
    encounterId === DEATH_ENCOUNTER_NUMERIC_ID ||
    encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
  ) {
    return false;
  }

  const essenceCost = essenceCostForOutcome(selectedRollOutcome, encounterDifficulty);
  if (essenceCost <= 0) {
    return false;
  }

  return currentEssence(inventoryAfterPenalty) <= 0;
}

function selectedActionForSnapshot(
  snapshot: EncounterSnapshot,
  action: PlayerEncounterAction,
): PlayerEncounterAction {
  if (snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
    return { type: 'dice' };
  }

  return action;
}

function roleRewardTypeForAvatar(avatar: AvatarDocument): 37 | 38 | 39 {
  switch (avatar.role) {
    case 'Warrior':
      return 38;
    case 'Rogue':
      return 39;
    case 'Mage':
      return 37;
    default:
      return avatar.profile.roleRewardType ?? 37;
  }
}

function raceRewardTypeForAvatar(avatar: AvatarDocument): 40 | 41 | 42 | 43 {
  switch (avatar.race) {
    case 'Rokur':
      return 40;
    case 'Verdani':
      return 41;
    case 'Aevis':
      return 42;
    case 'Grimnir':
      return 43;
    default:
      return avatar.profile.raceRewardType ?? 40;
  }
}

/** The avatar's own element, from its race (Babuni, 2026-11-21). */
function ownElementForAvatar(avatar: AvatarDocument): EssenceElement | null {
  return RACE_REWARD_TYPE_ELEMENTS[raceRewardTypeForAvatar(avatar)] ?? null;
}

/** Essences of the avatar's own element that exist in the game data. */
function ownEssenceIdsForAvatar(avatar: AvatarDocument): number[] {
  const element = ownElementForAvatar(avatar);
  if (!element) {
    return [];
  }
  const solutions = getSolutionMap();
  return essenceIdsOfElement(element).filter((id) => solutions[String(id)]?.mSolutionType === 15);
}

function randomSolutionByPredicate(
  predicate: (solution: ReturnType<typeof getSolutionMap>[string]) => boolean,
): number | null {
  const candidates = Object.values(getSolutionMap()).filter(predicate);

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(0, candidates.length - 1)].mSolutionID;
}

function randomEssenceReward(): number | null {
  return randomSolutionByPredicate(
    (solution) =>
      solution.mSolutionInventoryType === 3 &&
      solution.mSolutionRewardType === 3 &&
      solution.mSolutionType === 15,
  );
}

function randomSolutionsByRewardType(rewardType: number, count: number): number[] {
  const candidates = Object.values(getSolutionMap()).filter(
    (solution) => solution.mSolutionRewardType === rewardType,
  );

  if (candidates.length === 0 || count <= 0) {
    return [];
  }

  const rewards: number[] = [];

  for (let index = 0; index < count; index += 1) {
    rewards.push(candidates[randomInt(0, candidates.length - 1)].mSolutionID);
  }

  return rewards;
}

function randomSolutionType15Item(): number | null {
  return randomSolutionByPredicate((solution) => solution.mSolutionType === 15);
}

function applyLevelUpInventoryChanges(
  inventory: AvatarInventory,
  rewardIds: number[],
  newLevel: number,
): AvatarInventory {
  let next = inventory;
  const solutionMap = getSolutionMap();

  for (const rewardId of rewardIds) {
    const solution = solutionMap[String(rewardId)];

    if (!solution) {
      continue;
    }

    next = addRewardToInventoryState(
      next,
      rewardId,
      Math.max(1, (solution.mSolutionUses ?? 1) + (newLevel + 1)),
    );
  }

  return next;
}

function levelUpRewardIdsForSnapshot(
  avatar: AvatarDocument | undefined,
  rollE: number | undefined,
): number[] {
  if (!avatar || rollE === undefined) {
    return [];
  }

  return levelUpRewards(avatar, rollE);
}

/** Level-up choice (D-049): how many rewards the roll adds to the chosen one. One per 5 on the d20, at most 4. */
export function levelUpRolledRewardCount(roll: number): number {
  if (!Number.isFinite(roll)) {
    return 0;
  }
  return Math.max(0, Math.min(LEVEL_UP_MAX_ROLLED_REWARDS, Math.floor(roll / 5)));
}

export const LEVEL_UP_MAX_ROLLED_REWARDS = 4;
export const LEVEL_UP_CHOICE_COUNT = 3;

/**
 * Rolled level-up rewards (D-049), alternating race and role:
 * 1 = race; 2 = race + role; 3 = two race + role; 4 (a 20) = those three
 * and one rare type-15 item (another role reward if none exists).
 */
function levelUpRewards(avatar: AvatarDocument, roll: number): number[] {
  const raceType = raceRewardTypeForAvatar(avatar);
  const roleType = roleRewardTypeForAvatar(avatar);
  const count = levelUpRolledRewardCount(roll);
  const rewards: number[] = [];
  if (count >= 1) rewards.push(...randomSolutionsByRewardType(raceType, 1));
  if (count >= 2) rewards.push(...randomSolutionsByRewardType(roleType, 1));
  if (count >= 3) rewards.push(...randomSolutionsByRewardType(raceType, 1));
  if (count >= 4) {
    const rare = randomSolutionType15Item();
    rewards.push(...(rare === null ? randomSolutionsByRewardType(roleType, 1) : [rare]));
  }
  return rewards;
}

/**
 * The three level-up rewards the player chooses one of (D-049): different
 * rewards from the avatar's race and role types, avoiding the rolled ones
 * while enough others exist.
 */
export function levelUpChoiceIdsForAvatar(
  avatar: AvatarDocument | undefined,
  rolledRewardIds: readonly number[] = [],
): number[] {
  if (!avatar) {
    return [];
  }
  const raceType = raceRewardTypeForAvatar(avatar);
  const roleType = roleRewardTypeForAvatar(avatar);
  const candidates = Object.values(getSolutionMap())
    .filter((solution) => solution.mSolutionRewardType === raceType || solution.mSolutionRewardType === roleType)
    .map((solution) => solution.mSolutionID);
  const unique = [...new Set(candidates)];
  const fresh = unique.filter((id) => !rolledRewardIds.includes(id));
  const pool = fresh.length >= LEVEL_UP_CHOICE_COUNT ? fresh : unique;
  const choices: number[] = [];
  const remaining = [...pool];
  while (choices.length < LEVEL_UP_CHOICE_COUNT && remaining.length > 0) {
    const [picked] = remaining.splice(randomInt(0, remaining.length - 1), 1);
    choices.push(picked!);
  }
  return choices;
}

function isDeathEncounterFailureOutcome(outcome: RollOutcome | null): boolean {
  return outcome === 'Misery' || outcome === 'Hardship';
}

/** An Atranor item is spent the way a solution is spent in any other encounter. */
function inventoryAfterDeathEncounter(
  inventory: AvatarInventory,
  avatar: AvatarDocument,
  selectedRollOutcome: RollOutcome | null,
  usedSolutionIds: number[],
): {
  nextInventory: AvatarInventory;
  rewardIds: number[];
} {
  let spent = inventory;
  for (const solutionId of usedSolutionIds) {
    spent = consumeSolutionFromInventoryState(spent, solutionId, 1);
  }

  const deathOutcome = applyDeathEncounterOutcome(spent, avatar, selectedRollOutcome);
  return {
    nextInventory: deathOutcome.nextInventory,
    rewardIds: deathOutcome.rewardIds,
  };
}

function applyDeathEncounterOutcome(
  inventory: AvatarInventory,
  avatar: AvatarDocument,
  selectedRollOutcome: RollOutcome | null,
): {
  nextInventory: AvatarInventory;
  rewardIds: number[];
} {
  if (isDeathEncounterFailureOutcome(selectedRollOutcome)) {
    return {
      nextInventory: inventory,
      rewardIds: [],
    };
  }

  if (isDeathEncounterSurvivalOutcome(selectedRollOutcome)) {
    const essenceReward = randomEssenceReward();
    const essenceUses = deathEncounterEssenceUses(selectedRollOutcome);

    if (!essenceReward || essenceUses <= 0) {
      return { nextInventory: inventory, rewardIds: [] };
    }

    return {
      nextInventory: addRewardToInventoryState(inventory, essenceReward, essenceUses),
      rewardIds: [essenceReward],
    };
  }

  return { nextInventory: inventory, rewardIds: [] };
}

function withDeathEncounterRewards(
  resolution: EncounterResolution,
  rewardIds: number[],
): EncounterResolution {
  return rewardIds.length > 0
    ? { ...resolution, rewards: rewardIds }
    : resolution;
}

function isDeathEncounterSurvivalOutcome(outcome: RollOutcome | null): boolean {
  return outcome === 'Disengage' || outcome === 'Fortune' || outcome === 'Prosperity';
}

function deathEncounterEssenceUses(outcome: RollOutcome | null): number {
  switch (outcome) {
    case 'Disengage':
      return 1;
    case 'Fortune':
      return 2;
    case 'Prosperity':
      return 3;
    default:
      return 0;
  }
}

/** Gem sacrifice on Atranor failure — Fortune-tier essence reward on restored inventory. */
export function applyFortuneSacrificeReward(
  inventory: AvatarInventory,
  avatar: AvatarDocument,
): AvatarInventory {
  return applyDeathEncounterOutcome(inventory, avatar, 'Fortune').nextInventory;
}

function normalizeSystemEncounterResolution(
  snapshot: EncounterSnapshot,
  avatar: AvatarDocument,
  resolution: EncounterResolution,
  selectedRollOutcome: RollOutcome | null,
): EncounterResolution {
  if (snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
    const rewards = snapshot.rewardIds.length > 0
      ? snapshot.rewardIds
      : levelUpRewards(avatar, resolution.selectedRoll);

    return {
      ...resolution,
      usedInventorySolutions: [],
      failurePenalty: 0,
      success: true,
      rewards,
    };
  }

  if (snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID) {
    const survival = isDeathEncounterSurvivalOutcome(selectedRollOutcome);

    return {
      ...resolution,
      failurePenalty: 0,
      success: survival,
      rewards: [],
      message: survival
        ? `${snapshot.encounterTitle}: you escape and press onward (${selectedRollOutcome ?? 'unknown'}).`
        : `${snapshot.encounterTitle}: the realm claims this life (${selectedRollOutcome ?? 'unknown'}).`,
    };
  }

  return resolution;
}

function withProsperityEssenceReward(
  snapshot: EncounterSnapshot,
  resolution: EncounterResolution,
  selectedRollOutcome: ReturnType<typeof interpretRoll>,
): EncounterResolution {
  if (
    !resolution.success ||
    selectedRollOutcome !== 'Prosperity' ||
    snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID ||
    snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID
  ) {
    return resolution;
  }

  const essenceReward = snapshot.prosperityRewardId ?? randomEssenceReward();

  if (essenceReward === null) {
    return resolution;
  }

  return {
    ...resolution,
    rewards: [...resolution.rewards, essenceReward],
  };
}

function essenceCostForOutcome(
  outcome: ReturnType<typeof interpretRoll>,
  encounterDifficulty: number,
): number {
  if (outcome !== 'Hardship' && outcome !== 'Misery') {
    return 0;
  }

  return scaledUses(1, encounterDifficulty);
}

// ---------------------------------------------------------------------------
// Authoritative public API (server-only)
// ---------------------------------------------------------------------------

/** Read authoritative active snapshot (no roll regeneration). */
export async function getActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot | null> {
  const [snapshot, avatar] = await Promise.all([
    loadActiveEncounter(playerId, avatarId),
    loadAvatar(playerId, avatarId),
  ]);

  if (!snapshot) {
    return null;
  }

  const activeSnapshot = withPrecomputedSnapshotRewards(snapshot, avatar ?? undefined);
  if (activeSnapshot !== snapshot) {
    await saveActiveEncounter(activeSnapshot);
  }

  return activeSnapshot;
}

/**
 * Load snapshot, run pure deterministic resolver, persist resolved state.
 * Clears active encounter document on success.
 */
export async function resolveEncounter(
  playerId: string,
  avatarId: string,
  action: PlayerEncounterAction,
): Promise<ResolveEncounterResult> {
  const result = await continueEncounter(playerId, avatarId, action);
  return { snapshot: result.snapshot, resolution: result.resolution };
}

export async function continueEncounter(
  playerId: string,
  avatarId: string,
  action: PlayerEncounterAction,
): Promise<ContinueEncounterResult> {
  const activeSnapshot = await loadActiveEncounter(playerId, avatarId);

  if (!activeSnapshot) {
    throw new Error('No active encounter snapshot');
  }

  if (activeSnapshot.resolved || activeSnapshot.state === 'resolved') {
    throw new Error(`Encounter already resolved: ${activeSnapshot.snapshotId}`);
  }

  if (activeSnapshot.state !== 'active') {
    throw new Error(
      `Invalid encounter state transition: ${activeSnapshot.state} → continue`,
    );
  }

  const expectedSnapshotId = activeSnapshot.snapshotId;

  let eventContext: EncounterContinuedEventContext | null = null;
  let encounterDeathTriggered = false;
  let encounterAvatarDied = false;

  const result = await withDocumentTransaction(async (transaction) => {
      const claimedSnapshot = await claimActiveEncounterInTransaction(
        transaction,
        playerId,
        avatarId,
        expectedSnapshotId,
      );

      // A transaction uses one PostgreSQL client: query it sequentially.
      const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
      const inventoryDocument = await transaction.getInventory<AvatarInventory>(playerId, avatarId);
      const progressionDocument = await transaction.getProgression<ReturnType<typeof createInitialProgression>>(
        playerId, avatarId,
      );
      const playerData = await transaction.getPlayer<{ unlockedExpansions?: number[] }>(playerId);

      if (!avatar) {
        throw new Error(`Avatar not found: ${avatarId}`);
      }

      const currentFaces = replaceLegacyPercentRolls(claimedSnapshot);
      let encounterSnapshot = withPrecomputedSnapshotRewards(currentFaces, avatar);

      if (encounterSnapshot !== claimedSnapshot) {
        await transaction.setActiveEncounter(playerId, avatarId, encounterSnapshot);
      }

      const inventory = inventoryDocument
        ?? avatar.inventory
        ?? createInitialAvatarInventory(avatar.profile);
      const progression = progressionDocument
        ?? createInitialProgression(avatar.createdAt ?? Date.now());

      const actionForResolution = selectedActionForSnapshot(encounterSnapshot, action);
      const encounter = snapshotToEncounterData(encounterSnapshot);
      const baseResolution = runDeterministicResolver(
        encounter,
        flattenInventorySolutionIds(inventory),
        getSolutionMap(),
        snapshotToRolls(encounterSnapshot),
        toSelectedEncounterAction(actionForResolution),
        encounterSnapshot.rewardIds,
      );
      const selectedRollOutcome = interpretRoll(baseResolution.selectedRoll);
      let resolution = normalizeSystemEncounterResolution(
        encounterSnapshot,
        avatar,
        withProsperityEssenceReward(
          encounterSnapshot,
          baseResolution,
          selectedRollOutcome,
        ),
        selectedRollOutcome,
      );
      const progressionResult = applyProgressionForEncounter(
        progression,
        encounterSnapshot.encounterId,
        LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        DEATH_ENCOUNTER_NUMERIC_ID,
        selectedRollOutcome,
      );
      let nextInventory: AvatarInventory;

      if (encounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID) {
        const deathOutcome = inventoryAfterDeathEncounter(
          inventory,
          avatar,
          selectedRollOutcome,
          resolution.usedInventorySolutions,
        );
        nextInventory = deathOutcome.nextInventory;
        resolution = withDeathEncounterRewards(resolution, deathOutcome.rewardIds);
      } else if (encounterSnapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
        nextInventory = applyLevelUpInventoryChanges(
          inventory,
          resolution.rewards,
          progressionResult.progression.level,
        );
      } else {
        const inventoryApply = applyEncounterInventoryChanges(
          inventory,
          resolution.usedInventorySolutions,
          resolution.success ? resolution.rewards : [],
          resolution.success,
          selectedRollOutcome,
          encounterSnapshot.encounterDifficulty,
          encounterSnapshot.encounterRewardAmount,
          { ownElement: ownElementForAvatar(avatar) },
        );
        nextInventory = inventoryApply.inventory;
        resolution = {
          ...resolution,
          lostInventorySolutions: inventoryApply.lostInventorySolutions,
        };
      }

      const deathTriggered = shouldQueueDeathEncounterAfterFailure(
        resolution.success,
        encounterSnapshot.encounterId,
        selectedRollOutcome,
        encounterSnapshot.encounterDifficulty,
        nextInventory,
      );

      let resolvedSnapshot: EncounterSnapshot = {
        ...encounterSnapshot,
        resolved: true,
        state: 'resolved',
      };

      const deathAndLevelUp = deathTriggered && progressionResult.leveledUp;

      if (progressionResult.leveledUp && !deathTriggered) {
        resolvedSnapshot = {
          ...resolvedSnapshot,
          preparedEncounter: preparedSystemEncounter(LEVEL_UP_ENCOUNTER_NUMERIC_ID),
        };
      }

      if (deathTriggered) {
        resolvedSnapshot = {
          ...resolvedSnapshot,
          preparedEncounter: preparedSystemEncounter(DEATH_ENCOUNTER_NUMERIC_ID),
        };
      }

      const unlockedExpansions = Array.isArray(playerData?.unlockedExpansions) &&
        playerData.unlockedExpansions.length > 0
        ? playerData.unlockedExpansions.filter((entry): entry is number => Number.isInteger(entry))
        : [0];
      const nextEncounter = getNextEncounterAfterResolution(
        resolvedSnapshot,
        selectedRollOutcome,
        unlockedExpansions,
      );
      const preparedAfterActiveEncounter = deathAndLevelUp
        ? preparedSystemEncounter(LEVEL_UP_ENCOUNTER_NUMERIC_ID)
        : prepareNextEncounter(nextEncounter, unlockedExpansions);
      const nextSnapshot: EncounterSnapshot = {
        ...buildEncounterSnapshot(
          playerId,
          avatarId,
          nextEncounter,
          preparedAfterActiveEncounter,
          avatar,
        ),
        state: 'active',
      };

      let updatedAvatar: AvatarDocument = {
        ...avatar,
        id: avatar.id ?? avatarId,
        level: progressionResult.progression.level,
        experience: progressionResult.progression.experience,
        inventory: nextInventory,
        lastPlayedAt: progressionResult.progression.lastPlayedAt,
        progression: {
          ...avatar.progression,
          lastEncounterId: encounterSnapshot.encounterId,
        },
      };

      eventContext = {
        resolvedEncounterId: encounterSnapshot.encounterId,
        resolvedEncounterTitle: encounterSnapshot.encounterTitle,
        selectedRollOutcome,
        leveledUp: progressionResult.leveledUp,
        deathTriggered,
        isDeathEncounterResolution: encounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID,
      };
      encounterDeathTriggered = deathTriggered;
      encounterAvatarDied =
        eventContext.isDeathEncounterResolution &&
        isDeathEncounterFailureOutcome(selectedRollOutcome);

      if (encounterAvatarDied) {
        updatedAvatar = applyFailedDeathState(
          updatedAvatar,
          nextInventory,
          {
            ...progressionResult.progression,
            lastEncounterId: encounterSnapshot.encounterId,
          },
        );
      }

      await transaction.setProgression(
        playerId,
        avatarId,
        applyPendingLevelUpRewardsFlag(progressionResult.progression, {
          leveledUp: progressionResult.leveledUp,
          resolvedEncounterId: encounterSnapshot.encounterId,
          levelUpEncounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        }),
      );
      await transaction.setInventory(
        playerId,
        avatarId,
        updatedAvatar.inventory ?? nextInventory,
      );
      await transaction.setAvatar(playerId, avatarId, updatedAvatar, { merge: true });
      await transaction.setActiveEncounter(playerId, avatarId, nextSnapshot);

      return {
        avatar: updatedAvatar,
        snapshot: nextSnapshot,
        resolution,
      };
    });

  if (eventContext) {
    await recordEncounterContinuedEvents(
      playerId,
      result.avatar,
      result.resolution,
      eventContext,
    );
  }

  return {
    ...result,
    deathTriggered: encounterDeathTriggered,
    avatarDied: encounterAvatarDied,
  };
}

/** Remove active encounter document after completion. */
export async function clearEncounter(
  playerId: string,
  avatarId: string,
): Promise<void> {
  void playerId;
  void avatarId;
  throw new Error('clearEncounter is disabled; use /encounter/continue');
}

export interface ResolveParticipantInRoomResult {
  avatar: AvatarDocument;
  resolution: EncounterResolution;
  selectedRollOutcome: RollOutcome | null;
  deathTriggered: boolean;
  avatarDied: boolean;
  eventContext: EncounterContinuedEventContext;
  gainedExperience: number;
}

export interface PrepareParticipantOutcomeResult extends ResolveParticipantInRoomResult {
  preparedResult: ParticipantPreparedResult;
  preparedCommit: PreparedCommitBundle;
}

export function preparedResultFromResolve(
  result: ResolveParticipantInRoomResult,
): ParticipantPreparedResult {
  return {
    success: result.resolution.success,
    message: result.resolution.message,
    selectedRoll: result.resolution.selectedRoll,
    rewards: result.resolution.rewards,
    failurePenalty: result.resolution.failurePenalty,
    usedInventorySolutions: result.resolution.usedInventorySolutions,
    lostInventorySolutions: result.resolution.lostInventorySolutions,
    deathTriggered: result.deathTriggered,
    avatarDied: result.avatarDied,
    leveledUp: result.eventContext.leveledUp,
    gainedExperience: result.gainedExperience,
    ...(result.resolution.pickRolls ? { pickRolls: result.resolution.pickRolls } : {}),
    ...(result.resolution.diceFillRoll !== undefined ? { diceFillRoll: result.resolution.diceFillRoll } : {}),
    ...(result.resolution.diceFillRolls ? { diceFillRolls: result.resolution.diceFillRolls } : {}),
    ...(result.resolution.rewardChargeBonus
      ? { rewardChargeBonus: result.resolution.rewardChargeBonus }
      : {}),
  };
}

export const ROOM_SLOT_COUNT = 3;

export type SlotEncounterSnapshots = [
  EncounterSnapshot,
  EncounterSnapshot,
  EncounterSnapshot,
];

export interface RoomSlotParticipantRef {
  slotIndex: number;
  playerId: string;
  avatarId: string;
}

/** Shared encounter identity; per-slot rolls and rewards stay on slotSnapshot. */
export function alignSnapshotToRoomShell(
  shell: EncounterSnapshot,
  slotSnapshot: EncounterSnapshot,
): EncounterSnapshot {
  return {
    ...slotSnapshot,
    snapshotId: shell.snapshotId,
    encounterId: shell.encounterId,
    encounterTitle: shell.encounterTitle,
    encounterImageName: shell.encounterImageName,
    encounterText: shell.encounterText,
    encounterDifficulty: shell.encounterDifficulty,
    primarySolutionA: shell.primarySolutionA,
    primarySolutionB: shell.primarySolutionB,
    primarySolutionC: shell.primarySolutionC,
    primarySolutionD: shell.primarySolutionD,
    secondarySolutionTypeA: shell.secondarySolutionTypeA,
    secondarySolutionTypeB: shell.secondarySolutionTypeB,
    secondarySolutionTypeC: shell.secondarySolutionTypeC,
    secondarySolutionTypeD: shell.secondarySolutionTypeD,
    preparedEncounter: shell.preparedEncounter,
    actionReadyAt: shell.actionReadyAt,
    createdAt: shell.createdAt,
    loreGemOffer: shell.loreGemOffer,
    roomId: shell.roomId,
    state: shell.state,
    resolved: shell.resolved,
  };
}

export function bindSnapshotToParticipant(
  snapshot: EncounterSnapshot,
  playerId: string,
  avatarId: string,
): EncounterSnapshot {
  return {
    ...snapshot,
    playerId,
    avatarId,
  };
}

/** Pre-roll all room slots at an encounter boundary (solo seeds slots 1–2 for mid-join). */
export function buildSlotEncounterSnapshots(
  encounter: EncounterData,
  preparedEncounter: PreparedEncounter,
  roomId: string,
  leaderPlayerId: string,
  leaderAvatarId: string,
  leaderAvatar: AvatarDocument | undefined,
  participants: readonly RoomSlotParticipantRef[],
  avatarForParticipant: (
    playerId: string,
    avatarId: string,
  ) => AvatarDocument | undefined,
): SlotEncounterSnapshots {
  const shellBase = buildEncounterSnapshot(
    leaderPlayerId,
    leaderAvatarId,
    encounter,
    preparedEncounter,
    leaderAvatar,
  );
  const shell: EncounterSnapshot = {
    ...shellBase,
    roomId,
    state: 'active',
  };
  const claimedRewardIds = new Set<number>();
  const slotSnapshots: EncounterSnapshot[] = [];

  for (let slotIndex = 0; slotIndex < ROOM_SLOT_COUNT; slotIndex += 1) {
    const occupant = participants.find((entry) => entry.slotIndex === slotIndex);
    const playerId = occupant?.playerId ?? leaderPlayerId;
    const avatarId = occupant?.avatarId ?? leaderAvatarId;
    const avatar = occupant
      ? avatarForParticipant(playerId, avatarId) ?? leaderAvatar
      : leaderAvatar;

    let slotSnapshot = buildEncounterSnapshot(
      playerId,
      avatarId,
      encounter,
      preparedEncounter,
      avatar,
    );

    if (encounter.mEncounterID !== LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
      const rewardIds = randomRewardsForEncounter(encounter, claimedRewardIds);
      slotSnapshot = {
        ...slotSnapshot,
        rewardIds,
      };
      for (const rewardId of rewardIds) {
        claimedRewardIds.add(rewardId);
      }
    }

    slotSnapshots.push(alignSnapshotToRoomShell(shell, {
      ...slotSnapshot,
      snapshotId: shell.snapshotId,
      playerId,
      avatarId,
    }));
  }

  return slotSnapshots as SlotEncounterSnapshots;
}

function computeParticipantOutcome(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
  inventory: AvatarInventory,
  progression: ReturnType<typeof createInitialProgression>,
  encounterSnapshot: EncounterSnapshot,
  action: PlayerEncounterAction,
  options: { levelUpChoiceId?: number } = {},
): PrepareParticipantOutcomeResult {
  const snapshot = withPrecomputedSnapshotRewards(
    replaceLegacyPercentRolls(encounterSnapshot),
    avatar,
  );
  const actionForResolution = selectedActionForSnapshot(snapshot, action);
  const encounter = snapshotToEncounterData(snapshot);
  const rollsForResolution = snapshotToRolls(snapshot);
  const baseResolution = runDeterministicResolver(
    encounter,
    flattenInventorySolutionIds(inventory),
    getSolutionMap(),
    rollsForResolution,
    toSelectedEncounterAction(actionForResolution),
    snapshot.rewardIds,
  );
  const selectedRollOutcome = interpretRoll(baseResolution.selectedRoll);
  let resolution = normalizeSystemEncounterResolution(
    snapshot,
    avatar,
    withProsperityEssenceReward(
      snapshot,
      baseResolution,
      selectedRollOutcome,
    ),
    selectedRollOutcome,
  );
  const progressionResult = applyProgressionForEncounter(
    progression,
    snapshot.encounterId,
    LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    DEATH_ENCOUNTER_NUMERIC_ID,
    selectedRollOutcome,
  );
  const gainedExperience = snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
    || snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID
    ? 0
    : experienceForSelectedRollOutcome(selectedRollOutcome);
  let nextInventory: AvatarInventory;
  let levelUpReveal: ReturnType<typeof levelUpChoiceFor> | null = null;

  if (snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID) {
    const deathOutcome = inventoryAfterDeathEncounter(
      inventory,
      avatar,
      selectedRollOutcome,
      resolution.usedInventorySolutions,
    );
    nextInventory = deathOutcome.nextInventory;
    resolution = withDeathEncounterRewards(resolution, deathOutcome.rewardIds);
  } else if (snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
    // D-049: the commit always holds one chosen reward; until the player
    // chooses it is the first option, so leaving early still gives one.
    const levelUpChoice = levelUpChoiceFor(snapshot, options.levelUpChoiceId);
    if (levelUpChoice.committedId !== undefined) {
      resolution = { ...resolution, rewards: [...resolution.rewards, levelUpChoice.committedId] };
    }
    levelUpReveal = levelUpChoice;
    nextInventory = applyLevelUpInventoryChanges(
      inventory,
      resolution.rewards,
      progressionResult.progression.level,
    );
  } else {
    const ownEssenceBonus = ownElementEssenceBonus({
      selectedRoll: resolution.selectedRoll,
      success: resolution.success,
      ownEssenceIds: ownEssenceIdsForAvatar(avatar),
      randomInt,
    });
    if (ownEssenceBonus !== null) {
      resolution = { ...resolution, rewards: [...resolution.rewards, ownEssenceBonus] };
    }
    const inventoryApply = applyEncounterInventoryChanges(
      inventory,
      resolution.usedInventorySolutions,
      resolution.success ? resolution.rewards : [],
      resolution.success,
      selectedRollOutcome,
      snapshot.encounterDifficulty,
      snapshot.encounterRewardAmount,
      {
        chargeBonus: resolution.rewardChargeBonus ?? null,
        ownElement: ownElementForAvatar(avatar),
      },
    );
    nextInventory = inventoryApply.inventory;
    resolution = {
      ...resolution,
      lostInventorySolutions: inventoryApply.lostInventorySolutions,
    };
  }

  const deathTriggered = shouldQueueDeathEncounterAfterFailure(
    resolution.success,
    snapshot.encounterId,
    selectedRollOutcome,
    snapshot.encounterDifficulty,
    nextInventory,
  );

  const updatedAvatar: AvatarDocument = {
    ...avatar,
    id: avatar.id ?? avatarId,
    level: progressionResult.progression.level,
    experience: progressionResult.progression.experience,
    inventory: nextInventory,
    lastPlayedAt: progressionResult.progression.lastPlayedAt,
    progression: {
      ...avatar.progression,
      lastEncounterId: snapshot.encounterId,
    },
  };

  const eventContext: EncounterContinuedEventContext = {
    resolvedEncounterId: snapshot.encounterId,
    resolvedEncounterTitle: snapshot.encounterTitle,
    selectedRollOutcome,
    leveledUp: progressionResult.leveledUp,
    deathTriggered,
    isDeathEncounterResolution: snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID,
  };

  const avatarDied =
    eventContext.isDeathEncounterResolution &&
    isDeathEncounterFailureOutcome(selectedRollOutcome);

  let finalAvatar = updatedAvatar;
  if (avatarDied) {
    finalAvatar = applyFailedDeathState(
      updatedAvatar,
      nextInventory,
      {
        ...progressionResult.progression,
        lastEncounterId: snapshot.encounterId,
      },
    );
  }

  const resolveResult: ResolveParticipantInRoomResult = {
    avatar: finalAvatar,
    resolution,
    selectedRollOutcome,
    deathTriggered,
    avatarDied,
    eventContext,
    gainedExperience,
  };

  const preparedCommit: PreparedCommitBundle = {
    resolution,
    selectedRollOutcome,
    deathTriggered,
    avatarDied,
    gainedExperience,
    eventContext,
    nextInventory: finalAvatar.inventory ?? nextInventory,
    nextProgression: progressionResult.progression,
    updatedAvatar: finalAvatar,
  };

  const preparedResult = preparedResultFromResolve(resolveResult);
  if (levelUpReveal && levelUpReveal.options.length > 0) {
    preparedResult.levelUpChoiceIds = levelUpReveal.options;
    if (levelUpReveal.chosenId === undefined) {
      // Not chosen yet: the player sees only the rolled rewards.
      preparedResult.rewards = preparedResult.rewards.slice(0, -1);
    } else {
      preparedResult.levelUpChosenId = levelUpReveal.chosenId;
    }
  }

  return {
    ...resolveResult,
    preparedResult,
    preparedCommit,
  };
}

/** The level-up choice for a snapshot: its options, the player's valid pick, and what the commit holds. */
function levelUpChoiceFor(
  snapshot: EncounterSnapshot,
  requestedId: number | undefined,
): { options: number[]; chosenId?: number; committedId?: number } {
  const options = snapshot.levelUpChoiceIds ?? [];
  const chosenId = requestedId !== undefined && options.includes(requestedId) ? requestedId : undefined;
  return { options, chosenId, committedId: chosenId ?? options[0] };
}

/**
 * Dry-run resolve for room reveal — does not persist inventory, progression, or avatar.
 */
export async function prepareParticipantOutcome(
  transaction: DocumentTransaction,
  playerId: string,
  avatarId: string,
  encounterSnapshot: EncounterSnapshot,
  action: PlayerEncounterAction,
  options: { levelUpChoiceId?: number } = {},
): Promise<PrepareParticipantOutcomeResult> {
  // The transaction's row-locked reads share a single client.
  const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
  const inventoryDocument = await transaction.getInventory<AvatarInventory>(playerId, avatarId);
  const progressionDocument = await transaction.getProgression<ReturnType<typeof createInitialProgression>>(
    playerId, avatarId,
  );

  if (!avatar) {
    throw new Error(`Avatar not found: ${avatarId}`);
  }

  const inventory = inventoryDocument
    ?? avatar.inventory
    ?? createInitialAvatarInventory(avatar.profile);
  const progression = progressionDocument
    ?? createInitialProgression(avatar.createdAt ?? Date.now());

  return computeParticipantOutcome(
    playerId,
    avatarId,
    avatar,
    inventory,
    progression,
    encounterSnapshot,
    action,
    options,
  );
}

/** Persist a prepared room outcome and record continuation events. */
export async function commitPreparedOutcome(
  transaction: DocumentTransaction,
  playerId: string,
  avatarId: string,
  bundle: PreparedCommitBundle,
): Promise<ResolveParticipantInRoomResult> {
  await transaction.setProgression(
    playerId,
    avatarId,
    applyPendingLevelUpRewardsFlag(bundle.nextProgression, {
      leveledUp: bundle.eventContext.leveledUp,
      resolvedEncounterId: bundle.eventContext.resolvedEncounterId,
      levelUpEncounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    }),
  );
  await transaction.setInventory(playerId, avatarId, bundle.nextInventory);
  await transaction.setAvatar(playerId, avatarId, bundle.updatedAvatar, { merge: true });

  await recordEncounterContinuedEvents(
    playerId,
    bundle.updatedAvatar,
    bundle.resolution,
    bundle.eventContext,
  );

  return {
    avatar: bundle.updatedAvatar,
    resolution: bundle.resolution,
    selectedRollOutcome: bundle.selectedRollOutcome,
    deathTriggered: bundle.deathTriggered,
    avatarDied: bundle.avatarDied,
    eventContext: bundle.eventContext,
    gainedExperience: bundle.gainedExperience,
  };
}

/**
 * Resolve one participant against a shared room encounter snapshot.
 * Does not advance the room encounter — caller owns room lifecycle.
 */
export async function resolveParticipantInRoom(
  transaction: DocumentTransaction,
  playerId: string,
  avatarId: string,
  encounterSnapshot: EncounterSnapshot,
  action: PlayerEncounterAction,
): Promise<ResolveParticipantInRoomResult> {
  const prepared = await prepareParticipantOutcome(
    transaction,
    playerId,
    avatarId,
    encounterSnapshot,
    action,
  );
  return commitPreparedOutcome(
    transaction,
    playerId,
    avatarId,
    prepared.preparedCommit,
  );
}

/** Seed or update avatar document (inventory, profile, progression). */
export async function ensureAvatar(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  await saveAvatar(playerId, avatarId, avatar);
  await migrateAvatarUnlockedExpansionsToPlayer(playerId, avatarId, avatar);

  if (!(await inventoryExists(playerId, avatarId))) {
    await initializeAvatarInventory(playerId, avatarId, avatar.profile);
  }

  if (!(await progressionExists(playerId, avatarId))) {
    await initializeAvatarProgression(playerId, avatarId);
  }
}
