import assert from 'node:assert/strict';
import { HELPER_ACHIEVEMENT_ID } from './encounterSolveAchievements.js';
import { SPIRITGUIDE_ACHIEVEMENT_ID, SPIRITGUIDE_RANKS } from './spiritguideAchievement.js';
import { collectUnlockedTitlesFromAchievements } from './achievementTitles.js';

const helperStarted = collectUnlockedTitlesFromAchievements([{
  achievementId: HELPER_ACHIEVEMENT_ID,
  progress: 1,
  rank: 0,
  chainTitle: 'Helper',
  ranks: [
    { rank: 1, title: 'Kind Stranger' },
    { rank: 2, title: 'Trusted Hand' },
  ],
}]);

assert.deepEqual(
  helperStarted.map((entry) => entry.title),
  ['Helper'],
);

const helperRankOne = collectUnlockedTitlesFromAchievements([{
  achievementId: HELPER_ACHIEVEMENT_ID,
  progress: 50,
  rank: 1,
  chainTitle: 'Helper',
  ranks: [
    { rank: 1, title: 'Kind Stranger' },
    { rank: 2, title: 'Trusted Hand' },
  ],
}]);

assert.deepEqual(
  helperRankOne.map((entry) => entry.title).sort(),
  ['Helper', 'Kind Stranger'],
);

const spiritguideStarted = collectUnlockedTitlesFromAchievements([{
  achievementId: SPIRITGUIDE_ACHIEVEMENT_ID,
  progress: 1,
  rank: 0,
  chainTitle: 'Spiritguide',
  ranks: SPIRITGUIDE_RANKS.map((entry) => ({
    rank: entry.rank,
    title: entry.title,
  })),
}]);

assert.deepEqual(
  spiritguideStarted.map((entry) => entry.title),
  ['Spiritguide'],
);

const spiritguideRankOne = collectUnlockedTitlesFromAchievements([{
  achievementId: SPIRITGUIDE_ACHIEVEMENT_ID,
  progress: 3,
  rank: 1,
  chainTitle: 'Spiritguide',
  ranks: SPIRITGUIDE_RANKS.map((entry) => ({
    rank: entry.rank,
    title: entry.title,
  })),
}]);

assert.deepEqual(
  spiritguideRankOne.map((entry) => entry.title),
  ['Spiritguide'],
);

console.log('achievementTitles.test.ts passed');
