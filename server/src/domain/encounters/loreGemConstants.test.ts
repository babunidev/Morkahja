import assert from 'node:assert/strict';

import {
  LORE_GEM_MAX_MS,
  LORE_GEM_MIN_MS,
  rollLoreGemClaimableAt,
} from './loreGemConstants.js';

const now = 1_700_000_000_000;

assert.deepEqual(
  rollLoreGemClaimableAt(now, () => 0),
  { eligible: true, claimableAt: now + LORE_GEM_MIN_MS },
);

let callCount = 0;
const maxDelayOffer = rollLoreGemClaimableAt(now, () => {
  callCount += 1;
  return callCount === 1 ? 0 : 1;
});
assert.equal(maxDelayOffer.eligible, true);
assert.ok(maxDelayOffer.claimableAt !== null);
assert.ok(
  maxDelayOffer.claimableAt! >= now + LORE_GEM_MAX_MS
  && maxDelayOffer.claimableAt! <= now + LORE_GEM_MAX_MS + 1,
);

console.log('loreGemConstants.test.ts passed');
