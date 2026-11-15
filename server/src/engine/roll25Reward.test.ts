import assert from 'node:assert/strict';
import test from 'node:test';

import { rewardForRoll25 } from './roll25Reward.js';

const first = (): number => 0;

test('a total other than 25 leaves the rewards alone', () => {
  const result = rewardForRoll25({
    selectedRoll: 24,
    success: true,
    encounterRewards: [1, 2],
    currentRewards: [1, 2],
    normalItemIds: [9],
    pickIndex: first,
  });
  assert.deepEqual(result.rewardIds, [1, 2]);
  assert.equal(result.chargeBonus, null);
});

test('a 25 with room in the row adds one normal item that is not already there', () => {
  const result = rewardForRoll25({
    selectedRoll: 25,
    success: true,
    encounterRewards: [1, 2, 3],
    currentRewards: [1, 2, 3, 80],
    normalItemIds: [2, 9, 10],
    pickIndex: first,
  });
  assert.deepEqual(result.rewardIds, [1, 2, 3, 80, 9]);
  assert.equal(result.chargeBonus, null);
});

test('a 25 with five rewards adds two charges to one of them', () => {
  const result = rewardForRoll25({
    selectedRoll: 25.2,
    success: true,
    encounterRewards: [1, 2, 3, 4, 5],
    currentRewards: [1, 2, 3, 4, 5, 80],
    normalItemIds: [9],
    pickIndex: (length) => length - 1,
  });
  assert.deepEqual(result.rewardIds, [1, 2, 3, 4, 5, 80]);
  assert.deepEqual(result.chargeBonus, { solutionId: 5, charges: 2 });
});

test('a failed 25 grants nothing extra', () => {
  const result = rewardForRoll25({
    selectedRoll: 25,
    success: false,
    encounterRewards: [1],
    currentRewards: [],
    normalItemIds: [9],
    pickIndex: first,
  });
  assert.deepEqual(result.rewardIds, []);
  assert.equal(result.chargeBonus, null);
});
