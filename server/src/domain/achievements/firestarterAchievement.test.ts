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
assert.equal(firestarterRankFromState(1, 1), 0);
assert.equal(firestarterRankFromState(2, 5), 1);
assert.equal(firestarterRankFromState(3, 12), 2);
assert.equal(firestarterRankFromState(3, 14), 2);
assert.equal(firestarterRankFromState(3, 15), 3);
assert.equal(firestarterRankFromState(2, 29), 1);
assert.equal(firestarterRankFromState(3, 29), 3);
assert.equal(firestarterRankFromState(3, 30), 4);
assert.equal(firestarterRankFromState(2, 40), 4);

assert.deepEqual(firestarterProgressBand(0, 0), {
  bandStart: 0,
  bandEnd: 2,
  progressInBand: 0,
});
assert.equal(firestarterProgressBand(1, 1).progressInBand, 1 / 2);
assert.equal(firestarterProgressBand(2, 5).bandEnd, 3);
assert.equal(firestarterProgressBand(2, 5).progressInBand, 0);
assert.equal(firestarterProgressBand(3, 12).bandEnd, 15);
assert.equal(firestarterProgressBand(3, 12).progressInBand, 9 / 12);
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
assert.equal(legacyHeld.rank, 2);
assert.equal(legacyHeld.peakAvatarCount, 3);

const legacyStarted = mergeFirestarterPeaks(1, 1, 1, 1);
assert.equal(legacyStarted.rank, 0);
const legacyRankFour = mergeFirestarterPeaks(3, 4, 1, 5);
assert.equal(legacyRankFour.rank, 4);

console.log('firestarterAchievement.test.ts passed');
