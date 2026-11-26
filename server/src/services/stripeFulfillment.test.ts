import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getCatalogEntry } from '../domain/commerce/catalog.js';
import { getPlayer, pool, setPlayer } from '../db/postgresDocumentStore.js';
import { fulfillStripePurchase, listBuyersOfSkus } from '../db/commerceStore.js';
import { ALL_EXPANSIONS_SKUS } from '../domain/commerce/catalog.js';
import { getExpansions } from './gameData.js';
import { syncAllExpansionOwners } from './playerService.js';
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
await assert.rejects(
  fulfill(`cs_test_${randomUUID()}`, event),
  /already processed for another checkout session/,
  'one signed event must never be reused to grant a second checkout session',
);

// Recover an event marked processed by the old code before it recorded a
// purchase: the new grant is idempotent and its session is still unique.
const legacySession = `cs_test_${randomUUID()}`;
const legacyEvent = `evt_${randomUUID()}`;
await pool.query(
  'INSERT INTO processed_stripe_events (id, created_at) VALUES ($1, $2)',
  [legacyEvent, Date.now()],
);
assert.equal(await fulfill(legacySession, legacyEvent), true);
assert.equal(await fulfill(legacySession, legacyEvent), false);

const concurrentSession = `cs_test_${randomUUID()}`;
const concurrentlyFulfilled = await Promise.all([
  fulfill(concurrentSession, `evt_${randomUUID()}`),
  fulfill(concurrentSession, `evt_${randomUUID()}`),
]);
assert.deepEqual(concurrentlyFulfilled.sort(), [false, true]);

// The bundle owns every expansion in the catalog, active or not yet (Babuni, 2026-11-26).
const player = await getPlayer<PlayerDocument>(playerId);
for (const expansion of getExpansions().map((item) => item.mExtensioID)) {
  assert.ok(player?.unlockedExpansions.includes(expansion), `the bundle owns ${expansion}`);
}
assert.equal(player?.allExpansions, true);

// An expansion added later reaches bundle buyers at the next start, also a
// buyer from before the mark existed (found in the purchase records).
const earlyBuyer = `stripe-early-${randomUUID()}`;
await setPlayer(earlyBuyer, { playerId: earlyBuyer, playerName: 'Early', unlockedExpansions: [0, 1001, 1003, 1004] });
await pool.query(
  'INSERT INTO purchases (id, event_id, player_id, sku, amount_total, currency, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
  [`cs_test_${randomUUID()}`, `evt_${randomUUID()}`, earlyBuyer, 'bundle_expansions_all', 799, 'eur', Date.now()],
);
await setPlayer(playerId, { unlockedExpansions: [0, 1001] }, { merge: true });
const buyers = await listBuyersOfSkus(ALL_EXPANSIONS_SKUS);
assert.ok(buyers.includes(earlyBuyer));
assert.ok(await syncAllExpansionOwners(buyers) >= 2);
for (const id of [playerId, earlyBuyer]) {
  const owner = await getPlayer<PlayerDocument>(id);
  assert.equal(owner?.unlockedExpansions.length, getExpansions().length + 1, `${id} owns the base game and every expansion`);
  assert.equal(owner?.allExpansions, true);
}
await pool.query('DELETE FROM purchases WHERE player_id = $1', [earlyBuyer]);
await pool.query('DELETE FROM players WHERE id = $1', [earlyBuyer]);
for (const die of ['b','c','d','e','f']) {
  assert.ok(player?.unlockedDiceIds?.includes(die));
}
const rows = await pool.query(
  'SELECT id FROM purchases WHERE id=ANY($1::text[])',
  [[session, concurrentSession, legacySession]],
);
assert.equal(rows.rowCount, 3);
await pool.end();
console.log('stripeFulfillment.test.ts passed');
