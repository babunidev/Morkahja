/**
 * Encounter Generator Service — the ONLY authority for encounter creation,
 * snapshot persistence, and resolution orchestration.
 *
 * Client must NOT call selection, roll generation, or validation.
 * Client sends actions only; server owns all fate via Firebase snapshots.
 */
import { resolveEncounter as runDeterministicResolver } from '../engine/encounterResolver.ts';
import type { EncounterResolution } from '../engine/encounterResolver.ts';
import type { EncounterData, EncounterDataMap } from '../engine/types.ts';
import type { AvatarDocument, AvatarProfile } from '../types/avatar.ts';
import type {
  EncounterSnapshot,
  PlayerEncounterAction,
} from '../types/encounterSnapshot.ts';
import {
  snapshotToRolls,
  toSelectedEncounterAction,
} from '../types/encounterSnapshot.ts';
import { getEncounterById, getEncounters, getSolutionMap } from './gameData.ts';
import {
  clearActiveEncounter as deleteActiveEncounter,
  loadActiveEncounter,
  loadAvatar,
  saveActiveEncounter,
  saveAvatar,
} from './encounterPersistence.ts';

const RANDOM_ENCOUNTER_MIN_ID = 20001;
const MAX_EXPANSION_REROLLS = 200;

export interface EncounterSelectionContext {
  profile: AvatarProfile;
  previousEncounter?: EncounterData | null;
}

export interface ResolveEncounterResult {
  snapshot: EncounterSnapshot;
  resolution: EncounterResolution;
}

/** Inclusive integer in [min, max]. Server-only randomness at creation time. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isEncounterAllowed(
  encounter: EncounterData,
  profile: AvatarProfile,
): boolean {
  if (encounter.mEncounterExpansion === 0) {
    return true;
  }
  return profile.unlockedExpansions.includes(encounter.mEncounterExpansion);
}

function buildRandomPool(
  encounters: EncounterDataMap,
  profile: AvatarProfile,
): EncounterData[] {
  return Object.values(encounters).filter(
    (encounter) =>
      encounter.mEncounterID > RANDOM_ENCOUNTER_MIN_ID &&
      isEncounterAllowed(encounter, profile),
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

  const pool = buildRandomPool(encounters, context.profile);

  if (pool.length === 0) {
    throw new Error('No eligible random encounters for avatar expansions');
  }

  let attempts = 0;

  while (attempts < MAX_EXPANSION_REROLLS) {
    const candidate = pool[randomInt(0, pool.length - 1)];

    if (isEncounterAllowed(candidate, context.profile)) {
      return candidate;
    }

    attempts += 1;
  }

  throw new Error('Failed to select a valid random encounter after rerolls');
}

export function generateSnapshotRolls(): Pick<
  EncounterSnapshot,
  'rollA' | 'rollB' | 'rollC' | 'rollD' | 'rollE'
> {
  return {
    rollA: randomInt(61, 100),
    rollB: randomInt(40, 100),
    rollC: randomInt(61, 100),
    rollD: randomInt(40, 100),
    rollE: randomInt(1, 100),
  };
}

export function buildEncounterSnapshot(
  playerId: string,
  avatarId: string,
  encounter: EncounterData,
): EncounterSnapshot {
  const rolls = generateSnapshotRolls();

  return {
    snapshotId: crypto.randomUUID(),
    playerId,
    avatarId,
    encounterId: encounter.mEncounterID,
    ...rolls,
    resolved: false,
    createdAt: Date.now(),
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

async function persistLastEncounter(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
  encounterId: number,
): Promise<void> {
  await saveAvatar(playerId, avatarId, {
    ...avatar,
    progression: {
      ...avatar.progression,
      lastEncounterId: encounterId,
    },
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
    throw new Error(
      `Active encounter already in progress: ${existing.snapshotId}`,
    );
  }

  if (existing?.resolved) {
    await deleteActiveEncounter(playerId, avatarId);
  }

  const context: EncounterSelectionContext = {
    profile: avatar.profile,
    previousEncounter: previousEncounterFromAvatar(avatar),
  };

  const encounter = selectNextEncounter(context);
  const snapshot = buildEncounterSnapshot(playerId, avatarId, encounter);

  await saveActiveEncounter(snapshot);
  return snapshot;
}

/** Read authoritative active snapshot (no roll regeneration). */
export async function getActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot | null> {
  return loadActiveEncounter(playerId, avatarId);
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
  const snapshot = await loadActiveEncounter(playerId, avatarId);

  if (!snapshot) {
    throw new Error('No active encounter snapshot');
  }

  if (snapshot.resolved) {
    throw new Error(`Encounter already resolved: ${snapshot.snapshotId}`);
  }

  const avatar = await loadAvatar(playerId, avatarId);

  if (!avatar) {
    throw new Error(`Avatar not found: ${avatarId}`);
  }

  const encounter = getEncounterById(snapshot.encounterId);

  if (!encounter) {
    throw new Error(`Encounter data missing: ${snapshot.encounterId}`);
  }

  const resolution = runDeterministicResolver(
    encounter,
    avatar.inventory,
    getSolutionMap(),
    snapshotToRolls(snapshot),
    toSelectedEncounterAction(action),
  );

  const resolvedSnapshot: EncounterSnapshot = {
    ...snapshot,
    resolved: true,
  };

  await saveActiveEncounter(resolvedSnapshot);
  await persistLastEncounter(playerId, avatarId, avatar, snapshot.encounterId);

  if (resolution.success) {
    await clearEncounter(playerId, avatarId);
  }

  return { snapshot: resolvedSnapshot, resolution };
}

/** Remove active encounter document after completion. */
export async function clearEncounter(
  playerId: string,
  avatarId: string,
): Promise<void> {
  await deleteActiveEncounter(playerId, avatarId);
}

/** Seed or update avatar document (inventory, profile, progression). */
export async function ensureAvatar(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  await saveAvatar(playerId, avatarId, avatar);
}
