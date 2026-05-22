import assert from 'node:assert/strict';
import {
  blessedProgressBand,
  blessedRankFromProgress,
  isBlessedLuckyOutcome,
} from './blessedAchievement.js';

assert.equal(isBlessedLuckyOutcome('Prosperity'), true);
assert.equal(isBlessedLuckyOutcome('Fortune'), true);
assert.equal(isBlessedLuckyOutcome('Misery'), false);
assert.equal(isBlessedLuckyOutcome(undefined), false);

assert.equal(blessedRankFromProgress(0), 0);
assert.equal(blessedRankFromProgress(49), 0);
assert.equal(blessedRankFromProgress(50), 1);
assert.equal(blessedRankFromProgress(249), 1);
assert.equal(blessedRankFromProgress(250), 2);
assert.equal(blessedRankFromProgress(999), 2);
assert.equal(blessedRankFromProgress(1000), 3);
assert.equal(blessedRankFromProgress(4999), 3);
assert.equal(blessedRankFromProgress(5000), 4);

assert.deepEqual(blessedProgressBand(0), {
  bandStart: 0,
  bandEnd: 50,
  progressInBand: 0,
});
assert.equal(blessedProgressBand(25).progressInBand, 0.5);
assert.equal(blessedProgressBand(5000).bandEnd, null);

console.log('blessedAchievement.test.ts passed');
