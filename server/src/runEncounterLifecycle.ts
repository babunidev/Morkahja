/**
 * End-to-end authoritative loop (server-only):
 * createEncounter → getActiveEncounter → resolveEncounter → next active encounter
 *
 * Usage: npm run test:lifecycle
 */
import { randomUUID } from 'node:crypto';
import { interpretRoll } from './engine/diceInterpreter.js';
import {
  createEncounter,
  ensureAvatar,
  getActiveEncounter,
  resolveEncounter,
} from './services/encounterGenerator.js';
import type { PlayerEncounterAction } from './types/encounterSnapshot.js';
import type { AvatarDocument } from './types/avatar.js';
import { getEncounterById } from './services/gameData.js';

// Avoid overwriting persistent test/player records when rerunning the smoke test.
const PLAYER_ID = process.env.MORKAHJA_PLAYER_ID ?? `lifecycle-test-${randomUUID()}`;
const AVATAR_ID = process.env.MORKAHJA_AVATAR_ID ?? `lifecycle-avatar-${randomUUID()}`;

const TEST_AVATAR: AvatarDocument = {
  profile: { roleRewardType: 37, raceRewardType: 40 },
  progression: {},
};

const TEST_ACTION: PlayerEncounterAction = { type: 'primaryC' };

async function main(): Promise<void> {
  console.log('=== Morkahja server-authoritative encounter loop ===\n');
  console.log(`Player: ${PLAYER_ID}  Avatar: ${AVATAR_ID}\n`);

  await ensureAvatar(PLAYER_ID, AVATAR_ID, TEST_AVATAR);
  console.log('1. ensureAvatar → profile in persistence');

  const created = await createEncounter(PLAYER_ID, AVATAR_ID);
  console.log('2. createEncounter → select + rolls + persist');
  console.log(
    `   encounterId=${created.encounterId} snapshotId=${created.snapshotId} state=${created.state}`,
  );
  console.log(
    `   rolls A=${created.rollA} B=${created.rollB} C=${created.rollC} D=${created.rollD} E=${created.rollE}`,
  );

  const loaded = await getActiveEncounter(PLAYER_ID, AVATAR_ID);
  if (!loaded || loaded.snapshotId !== created.snapshotId) {
    throw new Error('getActiveEncounter mismatch');
  }
  if (loaded.state !== 'active') {
    throw new Error(`Expected active snapshot, got ${loaded.state}`);
  }
  console.log('3. getActiveEncounter → active snapshot matches PostgreSQL');

  const encounter = getEncounterById(loaded.encounterId);
  console.log(
    `   title: ${encounter?.mEncounterTitle ?? loaded.encounterId}`,
  );

  const { snapshot, resolution } = await resolveEncounter(
    PLAYER_ID,
    AVATAR_ID,
    TEST_ACTION,
  );
  console.log('4. resolveEncounter → deterministic engine (no new RNG)');
  console.log(`   action=${JSON.stringify(TEST_ACTION)}`);
  console.log(
    `   success=${resolution.success} resolved=${snapshot.resolved} state=${snapshot.state}`,
  );
  console.log(`   rollC → ${interpretRoll(loaded.rollC)}`);
  console.log(`   ${resolution.message}`);

  if (snapshot.resolved || snapshot.state !== 'active' || snapshot.snapshotId === created.snapshotId) {
    throw new Error('Expected a different active snapshot after resolution');
  }
  const after = await getActiveEncounter(PLAYER_ID, AVATAR_ID);
  if (!after || after.snapshotId !== snapshot.snapshotId || after.state !== 'active') {
    throw new Error('Expected the next active encounter to persist after resolution');
  }
  console.log('5. getActiveEncounter → next active snapshot retained');

  console.log('\n=== Loop complete ===');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
