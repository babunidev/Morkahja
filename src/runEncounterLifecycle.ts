/**
 * End-to-end authoritative loop (server-only):
 * createEncounter → getActiveEncounter → resolveEncounter → clearEncounter
 *
 * Usage: npm run test:lifecycle
 */
import { interpretRoll } from './engine/diceInterpreter.ts';
import {
  clearEncounter,
  createEncounter,
  ensureAvatar,
  getActiveEncounter,
  resolveEncounter,
} from './services/encounterGenerator.ts';
import type { PlayerEncounterAction } from './types/encounterSnapshot.ts';
import { getEncounterById } from './services/gameData.ts';

const PLAYER_ID = process.env.MORKAHJA_PLAYER_ID ?? 'test-player';
const AVATAR_ID = process.env.MORKAHJA_AVATAR_ID ?? 'test-avatar';

const TEST_AVATAR = {
  inventory: [10245, 10033],
  profile: { unlockedExpansions: [0] },
  progression: {},
};

const TEST_ACTION: PlayerEncounterAction = { type: 'primaryC' };

async function main(): Promise<void> {
  console.log('=== Morkahja server-authoritative encounter loop ===\n');
  console.log(`Player: ${PLAYER_ID}  Avatar: ${AVATAR_ID}\n`);

  await ensureAvatar(PLAYER_ID, AVATAR_ID, TEST_AVATAR);
  console.log('1. ensureAvatar → profile + inventory in Firestore');

  const created = await createEncounter(PLAYER_ID, AVATAR_ID);
  console.log('2. createEncounter → select + rolls + persist');
  console.log(
    `   encounterId=${created.encounterId} snapshotId=${created.snapshotId}`,
  );
  console.log(
    `   rolls A=${created.rollA} B=${created.rollB} C=${created.rollC} D=${created.rollD} E=${created.rollE}`,
  );

  const loaded = await getActiveEncounter(PLAYER_ID, AVATAR_ID);
  if (!loaded || loaded.snapshotId !== created.snapshotId) {
    throw new Error('getActiveEncounter mismatch');
  }
  console.log('3. getActiveEncounter → snapshot matches Firebase');

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
  console.log(`   success=${resolution.success} resolved=${snapshot.resolved}`);
  console.log(`   rollC → ${interpretRoll(loaded.rollC)}`);
  console.log(`   ${resolution.message}`);

  const after = await getActiveEncounter(PLAYER_ID, AVATAR_ID);

  if (resolution.success) {
    if (after !== null) {
      throw new Error('Expected snapshot cleared after success');
    }
    console.log('5. clearEncounter → implicit on success');
  } else {
    console.log('5. Failure — snapshot retained for retry');
    await clearEncounter(PLAYER_ID, AVATAR_ID);
    console.log('   clearEncounter (manual test cleanup)');
  }

  console.log('\n=== Loop complete ===');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
