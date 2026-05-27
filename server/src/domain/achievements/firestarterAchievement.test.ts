import assert from 'node:assert/strict';
import {
  decodeFirestarterProgress,
  encodeFirestarterProgress,
  firestarterProgressBand,
  firestarterRankFromState,
  totalAvatarLevels,
} from './firestarterAchievement.js';
import { mergeFirestarterPeaks } from './firestarterProgress.js';

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

assert.deepEqual(decodeFirestarterProgress(3), { peakAvatarCount: 3, peakTotalLevels: 0 });
assert.equal(encodeFirestarterProgress(3, 30), 3030);
assert.deepEqual(decodeFirestarterProgress(3030), { peakAvatarCount: 3, peakTotalLevels: 30 });

const afterDeath = mergeFirestarterPeaks(3030, 4, 2, 12);
assert.equal(afterDeath.rank, 4);
assert.equal(afterDeath.peakAvatarCount, 3);
assert.equal(afterDeath.peakTotalLevels, 30);

const legacyHeld = mergeFirestarterPeaks(3, 3, 1, 5);
assert.equal(legacyHeld.rank, 3);
assert.equal(legacyHeld.peakAvatarCount, 3);

console.log('firestarterAchievement.test.ts passed');
