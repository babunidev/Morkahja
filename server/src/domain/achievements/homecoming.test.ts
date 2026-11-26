import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPlayer, pool, setAvatar, setPlayer, setProgression } from '../../db/postgresDocumentStore.js';
import { HomelandNotForSaleError, unlockPlayerExpansion } from '../../services/playerService.js';
import type { PlayerDocument } from '../../types/player.js';
import { loadAchievementProgress } from './achievementPersistence.js';
import { HOMECOMING_ACHIEVEMENT_ID } from './homecomingAchievement.js';
import { homelandForRace, loadHomecomingState, syncHomecomingForAllAvatars, tryEarnHomeland } from './homecomingProgress.js';
import { HOMECOMING_RANKS } from './homecomingAchievement.js';
import { renderEventMessage } from '../news/renderEventMessage.js';

// Homecoming (D-065): 100 encounters on one avatar open its people's homeland, once.
assert.equal(homelandForRace('Verdani'), 1007);
assert.equal(homelandForRace('Rokur'), 1010);
assert.equal(homelandForRace('Aevis'), 1009);
assert.equal(homelandForRace('Grimnir'), 1009);
assert.equal(homelandForRace('Ogru'), null);

const playerId = `homecoming-${randomUUID()}`;
await setPlayer(playerId, { playerId, playerName: 'Homecoming Test', unlockedExpansions: [0] });
const avatar = async (race: string, encounters: number) => {
  const id = `avatar-${randomUUID()}`;
  await setAvatar(playerId, id, { id, name: race, race, role: 'Rogue' });
  await setProgression(playerId, id, { level: 5, experience: 0, encountersCompleted: encounters, encountersFailed: 0 });
  return id;
};
const homecoming = async () => (await loadAchievementProgress(playerId, HOMECOMING_ACHIEVEMENT_ID))?.progress ?? 0;

const verdani = await avatar('Verdani', 99);
assert.equal(await tryEarnHomeland(playerId, verdani), null, '99 encounters are not enough');
assert.deepEqual(await loadHomecomingState(playerId), { earned: 0, towardNext: 99 }, 'the panel shows the way to 100');
assert.notEqual(HOMECOMING_RANKS[0]?.title, 'Homecoming', 'the first title is not the chain name');
await setProgression(playerId, verdani, { level: 5, experience: 0, encountersCompleted: 100, encountersFailed: 0 });
const parallel = await Promise.all([tryEarnHomeland(playerId, verdani), tryEarnHomeland(playerId, verdani)]);
assert.deepEqual(parallel.filter((value) => value !== null), [1007], 'earned once, even in parallel');
assert.equal(await tryEarnHomeland(playerId, verdani), null, 'a one-time unlock');
let player = await getPlayer<PlayerDocument>(playerId);
assert.ok(player?.unlockedExpansions.includes(1007));
assert.deepEqual(player?.homecoming, [1007]);
assert.equal(await homecoming(), 1);

// Celesterra opens for an Aevis or a Grimnir, counted once.
const grimnir = await avatar('Grimnir', 140);
const aevis = await avatar('Aevis', 100);
assert.equal(await tryEarnHomeland(playerId, grimnir), 1009);
assert.equal(await tryEarnHomeland(playerId, aevis), null, 'Celesterra already open');
assert.equal(await homecoming(), 2);
assert.deepEqual(await loadHomecomingState(playerId), { earned: 2, towardNext: 0 }, 'no avatar is on the way to a closed homeland');

// Existing avatars earn it at start-up.
await avatar('Rokur', 230);
assert.ok(await syncHomecomingForAllAvatars() >= 1);
player = await getPlayer<PlayerDocument>(playerId);
assert.deepEqual(player?.homecoming, [1007, 1009, 1010]);
assert.equal(await homecoming(), 3, 'every homeland');
assert.equal((await loadHomecomingState(playerId)).earned, 3);

// Each opened homeland gets its own private message after the achievement (Babuni, 2026-11-26).
const opened = await pool.query<{ payload: Record<string, unknown>; visibility: string }>(
  `SELECT payload, visibility FROM game_events WHERE player_id = $1 AND type = 'homeland_opened' ORDER BY timestamp`,
  [playerId],
);
assert.deepEqual(opened.rows.map((row) => row.payload.expansionId), [1007, 1009, 1010], 'one message per homeland');
assert.ok(opened.rows.every((row) => row.visibility === 'private'));
assert.equal(
  renderEventMessage({ eventId: 'x', timestamp: 0, playerId, type: 'homeland_opened', visibility: 'private', importance: 'high', payload: opened.rows[1]!.payload }, playerId),
  'Celesterra, the homeland of the Aevis and the Grimnir, is unlocked. You can now travel there.',
);

// A homeland is never bought with gems.
await assert.rejects(unlockPlayerExpansion(playerId, 1010), HomelandNotForSaleError);

await pool.query('DELETE FROM progressions WHERE player_id = $1', [playerId]);
await pool.query('DELETE FROM avatars WHERE player_id = $1', [playerId]);
await pool.query('DELETE FROM player_achievements WHERE player_id = $1', [playerId]).catch(() => undefined);
await pool.query('DELETE FROM game_events WHERE player_id = $1', [playerId]);
await pool.query('DELETE FROM players WHERE id = $1', [playerId]);
await pool.end();
console.log('homecoming.test.ts passed');
