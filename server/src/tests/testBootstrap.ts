import { randomUUID } from 'node:crypto';
import {
  clearActiveEncounter,
  saveAvatar,
} from '../services/encounterPersistence.js';
import { resetAvatarProgression } from '../services/avatarProgressionService.js';
import {
  addRewardToInventory,
  resetInventory,
} from '../services/inventoryService.js';
import { ensurePlayerUnlockedExpansions } from '../services/playerService.js';
import type { AvatarDocument } from '../types/avatar.js';
import {
  deleteAvatar,
  deleteInventory,
  deletePlayer,
  deleteProgression,
  setPlayer,
} from '../db/postgresDocumentStore.js';

const TEST_RUN_ID = process.env.MORKAHJA_TEST_RUN_ID ?? randomUUID();

export const TEST_PLAYER_ID = `test-player-${TEST_RUN_ID}`;
export const TEST_AVATAR_ID = `test-avatar-${TEST_RUN_ID}`;

/**
 * Encounter 20192 follows into 19001 (Nerevals Sanctuary), giving the E2E
 * test a stable encounter while still exercising server-side creation.
 */
const FORCED_PREVIOUS_ENCOUNTER_ID = 20192;

const TEST_INVENTORY = [
  10033, // primary match for slot C on encounter 19001
  10013, // secondary match for solution type 22 on encounter 19001
  10245, // primary B definition, useful for compatibility/debugging
];

function baseTestAvatar(): AvatarDocument {
  return {
    profile: {
      roleRewardType: 37,
      raceRewardType: 40,
    },
    progression: {
      lastEncounterId: FORCED_PREVIOUS_ENCOUNTER_ID,
    },
    activeEncounter: null,
  };
}

export async function resetTestState(): Promise<void> {
  await setPlayer(TEST_PLAYER_ID, { test: true, updatedAt: Date.now() }, { merge: true });
  await ensurePlayerUnlockedExpansions(TEST_PLAYER_ID, [0]);

  await clearActiveEncounter(TEST_PLAYER_ID, TEST_AVATAR_ID);
  await resetInventory(TEST_PLAYER_ID, TEST_AVATAR_ID);
  await resetAvatarProgression(TEST_PLAYER_ID, TEST_AVATAR_ID);
  await saveAvatar(
    TEST_PLAYER_ID,
    TEST_AVATAR_ID,
    baseTestAvatar(),
  );
}

export async function seedTestInventory(): Promise<number[]> {
  await resetInventory(TEST_PLAYER_ID, TEST_AVATAR_ID);

  for (const solutionId of TEST_INVENTORY) {
    await addRewardToInventory(TEST_PLAYER_ID, TEST_AVATAR_ID, solutionId, 2);
  }

  return [...TEST_INVENTORY];
}

export async function ensureTestPlayer(): Promise<void> {
  await resetTestState();
  await seedTestInventory();
}

export async function cleanupTestPlayer(
  playerId = TEST_PLAYER_ID,
  avatarId = TEST_AVATAR_ID,
): Promise<void> {
  await clearActiveEncounter(playerId, avatarId);
  await deleteInventory(playerId, avatarId);
  await deleteProgression(playerId, avatarId);
  await deleteAvatar(playerId, avatarId);
  await deletePlayer(playerId);
}
