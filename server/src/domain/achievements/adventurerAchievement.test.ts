import assert from 'node:assert/strict';
import {
  adventurerDailyRewardGems,
  adventurerProgressBand,
  adventurerRankFromProgress,
} from './adventurerAchievement.js';

assert.equal(adventurerRankFromProgress(0), 0);
assert.equal(adventurerRankFromProgress(99), 0);
assert.equal(adventurerRankFromProgress(100), 1);
assert.equal(adventurerRankFromProgress(199), 1);
assert.equal(adventurerRankFromProgress(200), 2);
assert.equal(adventurerRankFromProgress(399), 2);
assert.equal(adventurerRankFromProgress(400), 3);
assert.equal(adventurerRankFromProgress(799), 3);
assert.equal(adventurerRankFromProgress(800), 4);
assert.equal(adventurerRankFromProgress(1200), 4);

assert.deepEqual(adventurerProgressBand(0), {
  bandStart: 0,
  bandEnd: 100,
  progressInBand: 0,
});
assert.equal(adventurerProgressBand(50).progressInBand, 0.5);
assert.equal(adventurerProgressBand(800).progressInBand, 1);
assert.equal(adventurerProgressBand(800).bandEnd, null);

assert.equal(adventurerDailyRewardGems(0), 1);
assert.equal(adventurerDailyRewardGems(4), 5);

console.log('adventurerAchievement.test.ts passed');
