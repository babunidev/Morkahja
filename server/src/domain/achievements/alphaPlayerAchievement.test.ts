import assert from 'node:assert/strict';
import {
  alphaPlayerDailyRewardGems,
  alphaPlayerProgressBand,
  alphaPlayerRankFromProgress,
} from './alphaPlayerAchievement.js';

assert.equal(alphaPlayerRankFromProgress(0), 0);
assert.equal(alphaPlayerRankFromProgress(19), 0);
assert.equal(alphaPlayerRankFromProgress(20), 1);
assert.equal(alphaPlayerRankFromProgress(39), 1);
assert.equal(alphaPlayerRankFromProgress(40), 2);
assert.equal(alphaPlayerRankFromProgress(79), 2);
assert.equal(alphaPlayerRankFromProgress(80), 3);
assert.equal(alphaPlayerRankFromProgress(159), 3);
assert.equal(alphaPlayerRankFromProgress(160), 4);
assert.equal(alphaPlayerRankFromProgress(500), 4);

assert.deepEqual(alphaPlayerProgressBand(0), {
  bandStart: 0,
  bandEnd: 20,
  progressInBand: 0,
});
assert.equal(alphaPlayerProgressBand(10).progressInBand, 0.5);
assert.equal(alphaPlayerProgressBand(160).progressInBand, 1);
assert.equal(alphaPlayerProgressBand(160).bandEnd, null);

assert.equal(alphaPlayerDailyRewardGems(0), 0);
assert.equal(alphaPlayerDailyRewardGems(1), 20);
assert.equal(alphaPlayerDailyRewardGems(4), 80);

console.log('alphaPlayerAchievement.test.ts passed');
