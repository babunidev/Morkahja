import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getCatalogEntry } from '../domain/commerce/catalog.js';
import { getPlayer, pool, setPlayer } from '../db/postgresDocumentStore.js';
import { fulfillStripePurchase } from '../db/commerceStore.js';
import type { PlayerDocument } from '../types/player.js';

const entry = getCatalogEntry('bundle_complete');
assert.ok(entry);
const playerId = `stripe-test-${randomUUID()}`;
await setPlayer(playerId, {
  playerId, playerName: 'Stripe Test', unlockedExpansions: [0], unlockedDiceIds: ['a'],
});

const fulfill = (id: string, eventId: string, grant = entry.grant) =>
  fulfillStripePurchase({
    id, eventId, playerId, sku: entry.sku, amountTotal: 1199, currency: 'eur',
  }, (transaction) => grant(playerId, transaction));

const session = `cs_test_${randomUUID()}`;
const event = `evt_${randomUUID()}`;
await assert.rejects(
  fulfill(session, event, async (id, transaction) => {
    await entry.grant(id, transaction);
    throw new Error('simulated grant failure');
  }),
  /simulated grant failure/,
);
assert.deepEqual((await getPlayer<PlayerDocument>(playerId))?.unlockedExpansions, [0]);
assert.deepEqual((await getPlayer<PlayerDocument>(playerId))?.unlockedDiceIds, ['a']);
assert.equal((await pool.query('SELECT id FROM purchases WHERE id=$1', [session])).rowCount, 0);
assert.equal((await pool.query('SELECT id FROM processed_stripe_events WHERE id=$1', [event])).rowCount, 0);

assert.equal(await fulfill(session, event), true);
assert.equal(await fulfill(session, event), false);
assert.equal(await fulfill(session, `evt_${randomUUID()}`), false, 'new event for same session must be ignored');

const concurrentSession = `cs_test_${randomUUID()}`;
const concurrentlyFulfilled = await Promise.all([
  fulfill(concurrentSession, `evt_${randomUUID()}`),
  fulfill(concurrentSession, `evt_${randomUUID()}`),
]);
assert.deepEqual(concurrentlyFulfilled.sort(), [false, true]);

const player = await getPlayer<PlayerDocument>(playerId);
for (const expansion of [1001, 1003, 1004]) {
  assert.ok(player?.unlockedExpansions.includes(expansion));
}
for (const die of ['b','c','d','e','f']) {
  assert.ok(player?.unlockedDiceIds?.includes(die));
}
const rows = await pool.query(
  'SELECT id FROM purchases WHERE id=ANY($1::text[])',
  [[session, concurrentSession]],
);
assert.equal(rows.rowCount, 2);
await pool.end();
console.log('stripeFulfillment.test.ts passed');
