import assert from 'node:assert/strict';
import {
  adventurerDailyRewardGems,
  adventurerProgressBand,
  adventurerRankFromProgress,
} from './adventurerAchievement.js';

assert.equal(adventurerRankFromProgress(0), 0);
assert.equal(adventurerRankFromProgress(41), 0);
assert.equal(adventurerRankFromProgress(42), 1);
assert.equal(adventurerRankFromProgress(83), 1);
assert.equal(adventurerRankFromProgress(84), 2);
assert.equal(adventurerRankFromProgress(168), 4);
assert.equal(adventurerRankFromProgress(200), 4);

assert.deepEqual(adventurerProgressBand(0), {
  bandStart: 0,
  bandEnd: 42,
  progressInBand: 0,
});
assert.equal(adventurerProgressBand(21).progressInBand, 0.5);
assert.equal(adventurerProgressBand(168).progressInBand, 1);
assert.equal(adventurerProgressBand(168).bandEnd, null);

assert.equal(adventurerDailyRewardGems(0), 1);
assert.equal(adventurerDailyRewardGems(4), 5);

console.log('adventurerAchievement.test.ts passed');
