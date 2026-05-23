import assert from 'node:assert/strict';
import { adventurerDailyRewardGems } from './adventurerAchievement.js';

assert.equal(adventurerDailyRewardGems(0), 1);
assert.equal(adventurerDailyRewardGems(4), 5);

console.log('dailyRewardService.test.ts passed');
