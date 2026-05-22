/**
 * Encounter Generator Service — the ONLY authority for encounter creation,
 * snapshot persistence, and resolution orchestration.
 *
 * Client must NOT call selection, roll generation, or validation.
 * Client sends actions only; server owns all fate via persisted snapshots.
 */
import { resolveEncounter as runDeterministicResolver } from '../engine/encounterResolver.js';
import type { EncounterResolution } from '../engine/encounterResolver.js';
import {
  acquireLock,
  releaseLock,
  transitionState,
} from '../domain/encounter/EncounterStateMachine.js';
import { interpretRoll, type RollOutcome } from '../engine/diceInterpreter.js';
import { createInitialProgression } from '../domain/avatar/AvatarProgression.js';
import type { EncounterData, EncounterDataMap } from '../engine/types.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { AvatarInventory } from '../types/avatar.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
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
  claimActiveEncounterForResolution,
  clearActiveEncounter as deleteActiveEncounter,
  loadActiveEncounter,
  loadAvatar,
  saveActiveEncounter,
  saveAvatar,
} from './encounterPersistence.js';
import {
  applyEncounterProgression,
  applyEncounterProgressionState,
  getAvatarEssenceSummary,
  initializeAvatarProgression,
  persistLastEncounter,
  progressionExists,
  resetAvatarProgression,
  touchAvatarProgression,
} from './avatarProgressionService.js';
import {
  addRewardToInventoryState,
  applyEncounterInventoryChanges,
  createInitialAvatarInventory,
  addRewardsToInventory,
  applyFailurePenalty,
  consumeSolutions,
  flattenInventorySolutionIds,
  getInventorySolutionIds,
  initializeAvatarInventory,
  inventoryExists,
  scaledUses,
} from './inventoryService.js';
import {
  getPlayerUnlockedExpansions,
  migrateAvatarUnlockedExpansionsToPlayer,
} from './playerService.js';
import {
  recordEncounterContinuedEvents,
  recordEncounterStartedEvent,
  type EncounterContinuedEventContext,
} from './gameEventService.js';

const RANDOM_ENCOUNTER_MIN_ID = 20001;
const MAX_EXPANSION_REROLLS = 200;
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
      encounter.mEncounterID > RANDOM_ENCOUNTER_MIN_ID &&
      !isSystemEncounterId(encounter.mEncounterID) &&
      isEncounterAllowed(encounter, unlockedExpansions),
  );
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
    const followUp = getEncounterById(previous.mEncounterFollow);
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

  let attempts = 0;

  while (attempts < MAX_EXPANSION_REROLLS) {
    const candidate = pool[randomInt(0, pool.length - 1)];

    if (isEncounterAllowed(candidate, context.unlockedExpansions)) {
      return candidate;
    }

    attempts += 1;
  }

  throw new Error('Failed to select a valid random encounter after rerolls');
}

export function prepareNextEncounter(
  currentEncounter: EncounterData,
  unlockedExpansions: number[],
  encounters: EncounterDataMap = getEncounters(),
): PreparedEncounter {
  void currentEncounter;

  const randomEncounter = selectRandomPreparedEncounter(
    unlockedExpansions,
    encounters,
  );

  return {
    encounterId: randomEncounter.mEncounterID,
    followMode: 'random',
  };
}

function selectRandomPreparedEncounter(
  unlockedExpansions: number[],
  encounters: EncounterDataMap,
): EncounterData {
  let attempts = 0;

  while (attempts < MAX_EXPANSION_REROLLS) {
    const candidates = Object.values(encounters).filter(
      (encounter) =>
        encounter.mEncounterID > RANDOM_ENCOUNTER_MIN_ID &&
        !isSystemEncounterId(encounter.mEncounterID),
    );

    if (candidates.length === 0) {
      throw new Error('No random encounters available for prefetch');
    }

    const candidate = candidates[randomInt(0, candidates.length - 1)];

    if (isEncounterAllowed(candidate, unlockedExpansions)) {
      return candidate;
    }

    attempts += 1;
  }

  throw new Error('Failed to prepare a valid random encounter after rerolls');
}

function preparedSystemEncounter(encounterId: number): PreparedEncounter {
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

export function generateSnapshotRolls(): Pick<
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
> {
  const rollPrimaryA = randomInt(61, 100);
  const rollPrimaryB = randomInt(61, 100);
  const rollPrimaryC = randomInt(61, 100);
  const rollPrimaryD = randomInt(61, 100);
  const rollSecondaryA = randomInt(40, 100);
  const rollSecondaryB = randomInt(40, 100);
  const rollSecondaryC = randomInt(40, 100);
  const rollSecondaryD = randomInt(40, 100);

  return {
    rollA: rollPrimaryA,
    rollB: rollSecondaryB,
    rollC: rollPrimaryC,
    rollD: rollSecondaryD,
    rollPrimaryA,
    rollPrimaryB,
    rollPrimaryC,
    rollPrimaryD,
    rollSecondaryA,
    rollSecondaryB,
    rollSecondaryC,
    rollSecondaryD,
    rollE: randomInt(1, 100),
  };
}

function randomRewardsForEncounter(encounter: EncounterData): number[] {
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
  let pool = [...candidates];

  for (let index = 0; index < amount; index += 1) {
    if (pool.length === 0) {
      pool = [...candidates];
    }

    const rewardIndex = randomInt(0, pool.length - 1);
    const [reward] = pool.splice(rewardIndex, 1);
    rewards.push(reward.mSolutionID);
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
  const rolls = generateSnapshotRolls();
  const rewardIds = encounter.mEncounterID === LEVEL_UP_ENCOUNTER_NUMERIC_ID
    ? levelUpRewardIdsForSnapshot(avatar, rolls.rollE)
    : randomRewardsForEncounter(encounter);

  return {
    snapshotId: crypto.randomUUID(),
    playerId,
    avatarId,
    encounterId: encounter.mEncounterID,
    ...encounterToSnapshotFields(encounter),
    ...rolls,
    rewardIds,
    prosperityRewardId: randomEssenceReward(),
    resolved: false,
    state: 'created',
    createdAt: Date.now(),
    preparedEncounter,
  };
}

function withPrecomputedSnapshotRewards(
  snapshot: EncounterSnapshot,
  avatar?: AvatarDocument,
): EncounterSnapshot {
  const hasRewardIds = Array.isArray(snapshot.rewardIds);
  const hasProsperityReward = 'prosperityRewardId' in snapshot;

  if (hasRewardIds && hasProsperityReward) {
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
    rewardIds: hasRewardIds && snapshot.encounterId !== LEVEL_UP_ENCOUNTER_NUMERIC_ID
      ? snapshot.rewardIds
      : rewardIds,
    prosperityRewardId: hasProsperityReward
      ? snapshot.prosperityRewardId
      : randomEssenceReward(),
  };
}

function previousEncounterFromAvatar(
  avatar: AvatarDocument,
): EncounterData | null {
  const lastId = avatar.progression?.lastEncounterId;

  if (typeof lastId !== 'number' || lastId <= 0) {
    return null;
  }

  return getEncounterById(lastId) ?? null;
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

function getNextEncounterAfterResolution(
  snapshot: EncounterSnapshot,
  selectedRollOutcome: ReturnType<typeof interpretRoll>,
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

  return selectRandomPreparedEncounter(unlockedExpansions, getEncounters());
}

function currentEssence(inventory: AvatarInventory): number {
  return inventory.essences
    .filter((item) => item.solutionType === 15)
    .reduce((total, item) => total + item.uses, 0);
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

function levelUpFortuneRewards(avatar: AvatarDocument): number[] {
  return [
    ...randomSolutionsByRewardType(raceRewardTypeForAvatar(avatar), 2),
    ...randomSolutionsByRewardType(roleRewardTypeForAvatar(avatar), 2),
  ];
}

function applyLevelUpInventoryChanges(
  inventory: AvatarInventory,
  rewardIds: number[],
  encounterDifficulty: number,
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
      scaledUses(solution.mSolutionUses ?? 1, encounterDifficulty),
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

  return levelUpRewards(avatar, interpretRoll(rollE));
}

function levelUpRewards(
  avatar: AvatarDocument,
  selectedRollOutcome: RollOutcome | null,
): number[] {
  const raceType = raceRewardTypeForAvatar(avatar);
  const roleType = roleRewardTypeForAvatar(avatar);

  switch (selectedRollOutcome) {
    case 'Misery':
      return randomSolutionsByRewardType(raceType, 1);
    case 'Hardship':
      return [
        ...randomSolutionsByRewardType(raceType, 1),
        ...randomSolutionsByRewardType(roleType, 1),
      ];
    case 'Disengage':
      return [
        ...randomSolutionsByRewardType(raceType, 2),
        ...randomSolutionsByRewardType(roleType, 1),
      ];
    case 'Fortune':
      return levelUpFortuneRewards(avatar);
    case 'Prosperity': {
      const type15Item = randomSolutionType15Item();
      return [
        ...levelUpFortuneRewards(avatar),
        ...(type15Item === null ? [] : [type15Item]),
      ];
    }
    default:
      return randomSolutionsByRewardType(raceType, 1);
  }
}

function isDeathEncounterFailureOutcome(outcome: RollOutcome | null): boolean {
  return outcome === 'Misery' || outcome === 'Hardship';
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

function normalizeSystemEncounterResolution(
  snapshot: EncounterSnapshot,
  avatar: AvatarDocument,
  resolution: EncounterResolution,
  selectedRollOutcome: RollOutcome | null,
): EncounterResolution {
  if (snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
    const rewards = snapshot.rewardIds.length > 0
      ? snapshot.rewardIds
      : levelUpRewards(avatar, selectedRollOutcome);

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
      usedInventorySolutions: [],
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

async function wouldEnterDeathState(
  playerId: string,
  avatarId: string,
  snapshot: EncounterSnapshot,
  resolution: EncounterResolution,
  selectedRollOutcome: ReturnType<typeof interpretRoll>,
): Promise<boolean> {
  if (
    resolution.success ||
    snapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID ||
    snapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID
  ) {
    return false;
  }

  const essenceCost = essenceCostForOutcome(
    selectedRollOutcome,
    snapshot.encounterDifficulty,
  );

  if (essenceCost <= 0) {
    return false;
  }

  const { currentEssence } = await getAvatarEssenceSummary(playerId, avatarId);
  return currentEssence <= essenceCost;
}

async function resetAvatarAfterDeathFailure(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  await resetAvatarProgression(playerId, avatarId);
  await initializeAvatarInventory(playerId, avatarId, avatar.profile);
  await saveAvatar(playerId, avatarId, {
    profile: avatar.profile,
    editMode: true,
    progression: {},
  });
}

// ---------------------------------------------------------------------------
// Authoritative public API (server-only)
// ---------------------------------------------------------------------------

/**
 * Select encounter, generate immutable rolls, persist to Firebase.
 * Path: /players/{playerId}/avatars/{avatarId}/activeEncounter/current
 */
export async function createEncounter(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot> {
  const avatar = await loadAvatar(playerId, avatarId);

  if (!avatar) {
    throw new Error(
      `Avatar not found: players/${playerId}/avatars/${avatarId}`,
    );
  }

  const existing = await loadActiveEncounter(playerId, avatarId);

  if (existing && !existing.resolved) {
    const activeSnapshot = withPrecomputedSnapshotRewards(existing, avatar);
    if (activeSnapshot !== existing) {
      await saveActiveEncounter(activeSnapshot);
    }
    return activeSnapshot;
  }

  const unlockedExpansions = await getPlayerUnlockedExpansions(playerId);

  const context: EncounterSelectionContext = {
    unlockedExpansions,
    previousEncounter: previousEncounterFromAvatar(avatar),
  };

  const encounter = existing?.resolved && existing.preparedEncounter
    ? getPreparedEncounter(existing)
    : selectNextEncounter(context);
  const preparedEncounter = prepareNextEncounter(encounter, unlockedExpansions);
  const snapshot = buildEncounterSnapshot(
    playerId,
    avatarId,
    encounter,
    preparedEncounter,
    avatar,
  );
  const activeSnapshot: EncounterSnapshot = {
    ...snapshot,
    state: 'active',
  };

  if (existing?.resolved) {
    await deleteActiveEncounter(playerId, avatarId);
  }

  await saveActiveEncounter(activeSnapshot);
  await recordEncounterStartedEvent(playerId, avatar, activeSnapshot);
  return activeSnapshot;
}

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

  acquireLock(activeSnapshot.snapshotId);

  let eventContext: EncounterContinuedEventContext | null = null;
  let encounterDeathTriggered = false;
  let encounterAvatarDied = false;

  try {
    const result = await withDocumentTransaction(async (transaction) => {
      const [
        snapshot,
        avatar,
        inventoryDocument,
        progressionDocument,
        playerData,
      ] = await Promise.all([
        transaction.getActiveEncounter<EncounterSnapshot>(playerId, avatarId),
        transaction.getAvatar<AvatarDocument>(playerId, avatarId),
        transaction.getInventory<AvatarInventory>(playerId, avatarId),
        transaction.getProgression<ReturnType<typeof createInitialProgression>>(playerId, avatarId),
        transaction.getPlayer<{ unlockedExpansions?: number[] }>(playerId),
      ]);

      if (!snapshot) {
        throw new Error('No active encounter snapshot');
      }

      if (!avatar) {
        throw new Error(`Avatar not found: ${avatarId}`);
      }

      const encounterSnapshot = withPrecomputedSnapshotRewards(snapshot, avatar);

      if (encounterSnapshot !== snapshot) {
        await transaction.setActiveEncounter(playerId, avatarId, encounterSnapshot);
      }

      const inventory = inventoryDocument
        ?? avatar.inventory
        ?? createInitialAvatarInventory(avatar.profile);
      const progression = progressionDocument
        ?? createInitialProgression(avatar.createdAt ?? Date.now());

      if (encounterSnapshot.resolved || encounterSnapshot.state === 'resolved') {
        throw new Error(`Encounter already resolved: ${encounterSnapshot.snapshotId}`);
      }

      if (encounterSnapshot.state !== 'active') {
        throw new Error(
          `Invalid encounter state transition: expected active, got ${encounterSnapshot.state}`,
        );
      }

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
      const resolution = normalizeSystemEncounterResolution(
        encounterSnapshot,
        avatar,
        withProsperityEssenceReward(
          encounterSnapshot,
          baseResolution,
          selectedRollOutcome,
        ),
        selectedRollOutcome,
      );
      const progressionResult = applyEncounterProgressionState(
        progression,
        selectedRollOutcome,
      );
      const essenceCost = essenceCostForOutcome(
        selectedRollOutcome,
        encounterSnapshot.encounterDifficulty,
      );
      const deathTriggered = !resolution.success &&
        encounterSnapshot.encounterId !== DEATH_ENCOUNTER_NUMERIC_ID &&
        encounterSnapshot.encounterId !== LEVEL_UP_ENCOUNTER_NUMERIC_ID &&
        essenceCost > 0 &&
        currentEssence(inventory) <= essenceCost;
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
      let nextInventory: AvatarInventory;

      if (encounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID) {
        if (isDeathEncounterFailureOutcome(selectedRollOutcome)) {
          nextInventory = createInitialAvatarInventory(avatar.profile);
        } else if (isDeathEncounterSurvivalOutcome(selectedRollOutcome)) {
          const essenceReward = randomEssenceReward();
          const essenceUses = deathEncounterEssenceUses(selectedRollOutcome);
          nextInventory = essenceReward && essenceUses > 0
            ? addRewardToInventoryState(inventory, essenceReward, essenceUses)
            : inventory;
        } else {
          nextInventory = inventory;
        }
      } else if (encounterSnapshot.encounterId === LEVEL_UP_ENCOUNTER_NUMERIC_ID) {
        nextInventory = applyLevelUpInventoryChanges(
          inventory,
          resolution.rewards,
          encounterSnapshot.encounterDifficulty,
        );
      } else {
        nextInventory = applyEncounterInventoryChanges(
          inventory,
          resolution.usedInventorySolutions,
          resolution.success ? resolution.rewards : [],
          resolution.success,
          selectedRollOutcome,
          encounterSnapshot.encounterDifficulty,
        );
      }
      const updatedAvatar: AvatarDocument = {
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

      await transaction.setProgression(playerId, avatarId, progressionResult.progression);
      await transaction.setInventory(playerId, avatarId, nextInventory);
      await transaction.setAvatar(playerId, avatarId, updatedAvatar, { merge: true });
      await transaction.setActiveEncounter(playerId, avatarId, nextSnapshot);

      eventContext = {
        resolvedEncounterId: encounterSnapshot.encounterId,
        resolvedEncounterTitle: encounterSnapshot.encounterTitle,
        selectedRollOutcome,
        leveledUp: progressionResult.leveledUp,
        deathTriggered,
        isDeathEncounterResolution: encounterSnapshot.encounterId === DEATH_ENCOUNTER_NUMERIC_ID,
      };
      encounterDeathTriggered = deathTriggered;
      // deathTriggered only queues Atranor; actual death is decided on that encounter's roll.
      encounterAvatarDied =
        eventContext.isDeathEncounterResolution &&
        isDeathEncounterFailureOutcome(selectedRollOutcome);

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
  } finally {
    releaseLock(activeSnapshot.snapshotId);
  }
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
