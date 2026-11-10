import assert from 'node:assert/strict';
import type { AchievementProgressDto } from '@shared/contracts';
import {
  findNewRankUnlocks,
  pickPrimaryUnlock,
  rankTitleForAchievement,
} from './achievementUnlockDetection.js';

function snapshot(progress: number, rank: number, achievementId = 'combatant'): AchievementProgressDto {
  return {
    achievementId,
    rank,
    progress,
    bandStart: 0,
    bandEnd: 50,
    progressInBand: progress / 50,
    baseIconUrl: '/test.webp',
    title: rank ? 'Initiate of Steel' : 'Combatant',
    text: 'Test achievement',
    chainTitle: 'Combatant',
    ranks: [{ rank: 1, title: 'Initiate of Steel', text: 'Milestone reached' }],
  };
}

// A started chain is visible, but it does not trigger the Scribes unlock toast.
assert.deepEqual(findNewRankUnlocks(null, [snapshot(50, 1)]), []);
assert.deepEqual(findNewRankUnlocks([], [snapshot(1, 0)]), []);
assert.deepEqual(findNewRankUnlocks([snapshot(0, 0)], [snapshot(1, 0)]), []);
assert.deepEqual(findNewRankUnlocks([snapshot(1, 0)], [snapshot(49, 0)]), []);

const rankOne = findNewRankUnlocks([snapshot(49, 0)], [snapshot(50, 1)]);
assert.equal(rankOne.length, 1);
assert.equal(rankOne[0].previousRank, 0);
assert.equal(rankOne[0].newRank, 1);
assert.equal(rankTitleForAchievement(rankOne[0].achievement), 'Initiate of Steel');

const alreadyUnlocked = findNewRankUnlocks([snapshot(50, 1)], [snapshot(51, 1)]);
assert.deepEqual(alreadyUnlocked, []);

const newlyLoadedMilestone = findNewRankUnlocks([], [snapshot(250, 2)]);
assert.equal(newlyLoadedMilestone[0]?.newRank, 2);

const two = findNewRankUnlocks(
  [snapshot(49, 0), snapshot(49, 0, 'helper')],
  [snapshot(50, 1), snapshot(250, 2, 'helper')],
);
assert.equal(pickPrimaryUnlock(two)?.newRank, 2);

console.log('achievementUnlockDetection.test.ts passed');
