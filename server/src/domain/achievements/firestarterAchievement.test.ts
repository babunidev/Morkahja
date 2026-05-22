import assert from 'node:assert/strict';
import {
  firestarterProgressBand,
  firestarterRankFromState,
  totalAvatarLevels,
} from './firestarterAchievement.js';

assert.equal(firestarterRankFromState(0, 0), 0);
assert.equal(firestarterRankFromState(1, 1), 1);
assert.equal(firestarterRankFromState(2, 5), 2);
assert.equal(firestarterRankFromState(3, 12), 3);
assert.equal(firestarterRankFromState(3, 29), 3);
assert.equal(firestarterRankFromState(3, 30), 4);
assert.equal(firestarterRankFromState(2, 40), 4);

assert.deepEqual(firestarterProgressBand(0, 0), {
  bandStart: 0,
  bandEnd: 3,
  progressInBand: 0,
});
assert.equal(firestarterProgressBand(1, 1).progressInBand, 1 / 3);
assert.equal(firestarterProgressBand(2, 5).progressInBand, 2 / 3);
assert.equal(firestarterProgressBand(3, 15).bandEnd, 30);
assert.equal(firestarterProgressBand(3, 30).bandEnd, null);

assert.equal(totalAvatarLevels([{ level: 5 }, { level: 10 }, { level: 15 }]), 30);

console.log('firestarterAchievement.test.ts passed');
