import assert from 'node:assert/strict';
import {
  spiritguideDailyRewardGems,
  spiritguideProgressBand,
  spiritguideRankDefinition,
  spiritguideRankFromProgress,
} from './spiritguideAchievement.js';

assert.equal(spiritguideRankFromProgress(0), 0);
assert.equal(spiritguideRankFromProgress(2), 0);
assert.equal(spiritguideRankFromProgress(3), 1);
assert.equal(spiritguideRankFromProgress(8), 1);
assert.equal(spiritguideRankFromProgress(9), 2);
assert.equal(spiritguideRankFromProgress(20), 2);
assert.equal(spiritguideRankFromProgress(21), 3);
assert.equal(spiritguideRankFromProgress(53), 3);
assert.equal(spiritguideRankFromProgress(54), 4);
assert.equal(spiritguideRankFromProgress(500), 4);

assert.equal(spiritguideRankDefinition(1)?.title, 'Spiritguide');
assert.equal(spiritguideRankDefinition(2)?.title, 'Bondforger');
assert.equal(spiritguideRankDefinition(3)?.title, 'Soulwarden');
assert.equal(spiritguideRankDefinition(4)?.title, 'Elder');
assert.equal(spiritguideRankDefinition(0), null);

assert.deepEqual(spiritguideProgressBand(0), {
  bandStart: 0,
  bandEnd: 3,
  progressInBand: 0,
});
assert.equal(spiritguideProgressBand(6).bandStart, 3);
assert.equal(spiritguideProgressBand(6).bandEnd, 9);
assert.equal(spiritguideProgressBand(54).bandEnd, null);
assert.equal(spiritguideProgressBand(54).progressInBand, 1);

assert.equal(spiritguideDailyRewardGems(0), 1);
assert.equal(spiritguideDailyRewardGems(4), 5);

console.log('spiritguideAchievement.test.ts passed');
