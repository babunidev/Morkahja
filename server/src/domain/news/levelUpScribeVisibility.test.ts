import assert from 'node:assert/strict';

import { levelUpScribeVisibility } from './levelUpScribeVisibility.js';

assert.equal(levelUpScribeVisibility(2), 'friends');
assert.equal(levelUpScribeVisibility(4), 'friends');
assert.equal(levelUpScribeVisibility(5), 'global');
assert.equal(levelUpScribeVisibility(6), 'friends');
assert.equal(levelUpScribeVisibility(10), 'global');
assert.equal(levelUpScribeVisibility(15), 'global');
assert.equal(levelUpScribeVisibility(0), 'friends');
assert.equal(levelUpScribeVisibility(1.5), 'friends');

console.log('levelUpScribeVisibility.test.ts: all assertions passed');
