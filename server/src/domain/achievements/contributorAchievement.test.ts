import assert from 'node:assert/strict';
import {
  contributorProgressBand,
  contributorRankFromProgress,
} from './contributorAchievement.js';

assert.equal(contributorRankFromProgress(0), 0);
assert.equal(contributorRankFromProgress(99), 0);
assert.equal(contributorRankFromProgress(100), 1);
assert.equal(contributorRankFromProgress(299), 1);
assert.equal(contributorRankFromProgress(300), 2);
assert.equal(contributorRankFromProgress(699), 2);
assert.equal(contributorRankFromProgress(700), 3);
assert.equal(contributorRankFromProgress(1499), 3);
assert.equal(contributorRankFromProgress(1500), 4);

assert.deepEqual(contributorProgressBand(0), {
  bandStart: 0,
  bandEnd: 100,
  progressInBand: 0,
});
assert.equal(contributorProgressBand(150).bandStart, 100);
assert.equal(contributorProgressBand(150).bandEnd, 300);
assert.equal(contributorProgressBand(1500).bandEnd, null);

console.log('contributorAchievement.test.ts passed');
