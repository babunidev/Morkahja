/**
 * Internal persistence. Mirrors the original document paths in PostgreSQL.
 * Authority path: /players/{playerId}/avatars/{avatarId}/activeEncounter/current
 */
import { transitionState } from '../domain/encounter/EncounterStateMachine.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import type { AvatarDocument } from '../types/avatar.js';
import {
  deleteActiveEncounter as deleteActiveEncounterDocument,
  getActiveEncounter,
  getAvatar,
  setActiveEncounter,
  setAvatar,
  withDocumentTransaction,
  type DocumentTransaction,
} from '../db/postgresDocumentStore.js';

/** Concurrent continue or stale client — map to HTTP 409 in encounterControllerErrorStatus. */
export class EncounterConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncounterConflictError';
  }
}

function toResolvingEncounterSnapshot(snapshot: EncounterSnapshot): EncounterSnapshot {
  return {
    ...snapshot,
    state: transitionState('active', 'resolving'),
    resolved: false,
  };
}

export function assertEncounterClaimable(
  snapshot: EncounterSnapshot,
  expectedSnapshotId?: string,
): void {
  if (expectedSnapshotId && snapshot.snapshotId !== expectedSnapshotId) {
    throw new EncounterConflictError(
      `Encounter snapshot mismatch: expected ${expectedSnapshotId}, got ${snapshot.snapshotId}`,
    );
  }

  if (snapshot.resolved || snapshot.state === 'resolved') {
    throw new EncounterConflictError(`Encounter already resolved: ${snapshot.snapshotId}`);
  }

  if (snapshot.state === 'resolving') {
    throw new EncounterConflictError('Encounter already resolving');
  }

  if (snapshot.state !== 'active') {
    throw new EncounterConflictError(
      `Invalid encounter state: expected active, got ${snapshot.state}`,
    );
  }
}

/**
 * Claim encounter under row lock (FOR UPDATE). Safe across multiple server instances.
 */
export async function claimActiveEncounterInTransaction(
  transaction: DocumentTransaction,
  playerId: string,
  avatarId: string,
  expectedSnapshotId?: string,
): Promise<EncounterSnapshot> {
  const snapshot = await transaction.getActiveEncounter<EncounterSnapshot>(playerId, avatarId);

  if (!snapshot) {
    throw new Error('No active encounter snapshot');
  }

  assertEncounterClaimable(snapshot, expectedSnapshotId);
  const resolvingSnapshot = toResolvingEncounterSnapshot(snapshot);
  await transaction.setActiveEncounter(playerId, avatarId, resolvingSnapshot);
  return resolvingSnapshot;
}

export async function loadAvatar(
  playerId: string,
  avatarId: string,
): Promise<AvatarDocument | null> {
  return getAvatar<AvatarDocument>(playerId, avatarId);
}

export async function saveActiveEncounter(
  snapshot: EncounterSnapshot,
): Promise<void> {
  await setActiveEncounter(snapshot.playerId, snapshot.avatarId, snapshot);
}

export async function loadActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot | null> {
  return getActiveEncounter<EncounterSnapshot>(playerId, avatarId);
}

/**
 * Atomically claim the active encounter for resolution.
 * Enforces the only valid runtime transition into the resolver:
 * active -> resolving.
 */
export async function claimActiveEncounterForResolution(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot> {
  return withDocumentTransaction(async (transaction) => (
    claimActiveEncounterInTransaction(transaction, playerId, avatarId)
  ));
}

export async function clearActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<void> {
  await deleteActiveEncounterDocument(playerId, avatarId);
}

export async function saveAvatar(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  await setAvatar(playerId, avatarId, avatar, { merge: true });
}
