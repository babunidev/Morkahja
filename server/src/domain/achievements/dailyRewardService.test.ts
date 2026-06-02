import assert from 'node:assert/strict';
import { adventurerDailyRewardGems, standardAchievementDailyRewardGems } from './adventurerAchievement.js';
import { alphaPlayerDailyRewardGems } from './alphaPlayerAchievement.js';
import {
  computeDailyRewardGems,
  MAX_DAILY_REWARD_GEMS,
  sumAchievementRanks,
} from './achievementDailyReward.js';

assert.equal(standardAchievementDailyRewardGems(0), 1);
assert.equal(standardAchievementDailyRewardGems(4), 5);
assert.equal(adventurerDailyRewardGems(0), 1);
assert.equal(adventurerDailyRewardGems(4), 5);

assert.equal(alphaPlayerDailyRewardGems(0), 0);
assert.equal(alphaPlayerDailyRewardGems(4), 80);

const allZero: Parameters<typeof computeDailyRewardGems>[0] = {
  adventurer: 0,
  firestarter: 0,
  blessed: 0,
  combatant: 0,
  trickster: 0,
  helper: 0,
  contributor: 0,
  spiritguide: 0,
  alphaPlayer: 0,
};

assert.equal(computeDailyRewardGems(allZero), 8);

const allMax = {
  adventurer: 4,
  firestarter: 4,
  blessed: 4,
  combatant: 4,
  trickster: 4,
  helper: 4,
  contributor: 4,
  spiritguide: 4,
  alphaPlayer: 4,
};

assert.equal(computeDailyRewardGems(allMax), 120);
assert.equal(sumAchievementRanks(allMax), 36);
assert.ok(MAX_DAILY_REWARD_GEMS >= 120);

assert.equal(
  computeDailyRewardGems({ ...allZero, adventurer: -5, blessed: 99 }),
  12,
);

console.log('dailyRewardService.test.ts passed');
