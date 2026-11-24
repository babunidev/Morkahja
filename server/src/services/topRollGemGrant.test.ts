import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPlayer, pool, setPlayer, withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { grantPlayerYellowRedGemsInTransaction } from './playerService.js';
import { grantTopRollGemInTransaction } from './topRollGem.js';
import type { PlayerDocument } from '../types/player.js';

// The top roll's gem (Babuni, 2026-11-24): one gem on a 26, none on a 25,
// once per roll even when two commits race, and on top of the lore gem.
const playerId = `top-roll-${randomUUID()}`;
await setPlayer(playerId, {
  playerId, playerName: 'Top Roll Test', unlockedExpansions: [0],
  currencies: { yellow_red_gem: 0 },
});
const gems = async () => (await getPlayer<PlayerDocument>(playerId))?.currencies?.yellow_red_gem;

assert.equal(await withDocumentTransaction((tx) => grantTopRollGemInTransaction(tx, playerId, 25, 'snap-a')), false);
assert.equal(await gems(), 0);

const raced = await Promise.all([
  withDocumentTransaction((tx) => grantTopRollGemInTransaction(tx, playerId, 26, 'snap-a')),
  withDocumentTransaction((tx) => grantTopRollGemInTransaction(tx, playerId, 26, 'snap-a')),
]);
assert.deepEqual(raced.sort(), [false, true]);
assert.equal(await gems(), 1);

// The lore gem of the same encounter is its own gem: two in all.
await withDocumentTransaction((tx) => grantPlayerYellowRedGemsInTransaction(tx, playerId, 1, `snap-a:${playerId}`));
assert.equal(await gems(), 2);

// A level-up chained after Atranor in the same snapshot counts apart.
assert.equal(await withDocumentTransaction((tx) => grantTopRollGemInTransaction(tx, playerId, 26, 'snap-a', 1)), true);
assert.equal(await withDocumentTransaction((tx) => grantTopRollGemInTransaction(tx, playerId, 26, 'snap-a', 2)), true);
assert.equal(await gems(), 4);

await pool.end();
console.log('topRollGemGrant.test.ts passed');
