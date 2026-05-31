import assert from 'node:assert/strict';
import { getExpansionById } from './gameData.js';

const winterValley = getExpansionById(1003);

assert.ok(winterValley, 'winter valley expansion should exist');
assert.equal(winterValley.mExtensioActive, true);
assert.equal(winterValley.mExtensioCost, 50);

const inactive = getExpansionById(1002);

assert.ok(inactive, 'urcogor ravage expansion should exist');
assert.equal(inactive.mExtensioActive, false);

assert.equal(getExpansionById(9999), undefined);

console.log('expansionUnlock.test.ts: ok');
