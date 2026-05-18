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
} from '../db/postgresDocumentStore.js';

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
  return withDocumentTransaction(async (transaction) => {
    const snapshot = await transaction.getActiveEncounter<EncounterSnapshot>(playerId, avatarId);

    if (!snapshot) {
      throw new Error('No active encounter snapshot');
    }

    if (snapshot.resolved || snapshot.state === 'resolved') {
      throw new Error(`Encounter already resolved: ${snapshot.snapshotId}`);
    }

    if (snapshot.state !== 'active') {
      throw new Error(
        `Invalid encounter state transition: expected active, got ${snapshot.state}`,
      );
    }

    const resolvingSnapshot: EncounterSnapshot = {
      ...snapshot,
      state: transitionState(snapshot.state, 'resolving'),
      resolved: false,
    };

    await transaction.setActiveEncounter(playerId, avatarId, resolvingSnapshot);
    return resolvingSnapshot;
  });
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
