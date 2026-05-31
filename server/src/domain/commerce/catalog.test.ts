import assert from 'node:assert/strict';
import { getCatalogEntry, isKnownSku } from './catalog.js';
import { PRICE_KEYS, getPriceId } from '../../config/stripeConfig.js';

// Every purchasable SKU resolves to a catalog entry with the expected price key.
const EXPECTED: Array<[string, string]> = [
  ['expansion_1001', 'expansion_1001'],
  ['expansion_1002', 'expansion_1002'],
  ['expansion_1003', 'expansion_1003'],
  ['expansion_1004', 'expansion_1004'],
  ['dice_b', 'dice_single'],
  ['dice_c', 'dice_single'],
  ['dice_d', 'dice_single'],
  ['dice_e', 'dice_single'],
  ['dice_f', 'dice_single'],
  ['bundle_expansions_all', 'bundle_expansions_all'],
  ['bundle_dice_all', 'bundle_dice_all'],
  ['bundle_complete', 'bundle_complete'],
];

for (const [sku, priceKey] of EXPECTED) {
  const entry = getCatalogEntry(sku);
  assert.ok(entry, `catalog should contain SKU ${sku}`);
  assert.equal(entry.priceKey, priceKey, `SKU ${sku} should map to price key ${priceKey}`);
  assert.equal(typeof entry.grant, 'function', `SKU ${sku} should expose a grant function`);
}

// The default dice (a) is not purchasable.
assert.equal(getCatalogEntry('dice_a'), undefined, 'default dice should not be purchasable');
assert.equal(isKnownSku('not_a_real_sku'), false);

// Every price key has a resolvable price id (the committed live defaults).
for (const priceKey of PRICE_KEYS) {
  const priceId = getPriceId(priceKey);
  assert.ok(priceId && priceId.startsWith('price_'), `price key ${priceKey} should resolve to a price id`);
}

console.log('catalog.test.ts: ok');
