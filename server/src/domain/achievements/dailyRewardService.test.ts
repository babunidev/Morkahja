import assert from 'node:assert/strict';
import { dailyRewardGemsFromTotalRank } from './dailyRewardService.js';
import { adventurerDailyRewardGems } from './adventurerAchievement.js';

assert.equal(dailyRewardGemsFromTotalRank(0), 1);
assert.equal(dailyRewardGemsFromTotalRank(4), 5);
assert.equal(dailyRewardGemsFromTotalRank(2 + 3 + 1), 7);

assert.equal(adventurerDailyRewardGems(0), 1);
assert.equal(adventurerDailyRewardGems(4), 5);

console.log('dailyRewardService.test.ts passed');
