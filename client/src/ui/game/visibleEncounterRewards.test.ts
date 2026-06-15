import assert from 'node:assert/strict';

import {
  rewardQuantityForVisibleEntry,
  visibleEncounterRewards,
} from './visibleEncounterRewards.js';

const NORMAL_ENCOUNTER_ID = 42;
const USES_BY_ID: Record<number, number> = {
  101: 3,
  102: 3,
  201: 5,
};

function getSolutionUses(rewardId: number): number | undefined {
  return USES_BY_ID[rewardId];
}

{
  const rewards = visibleEncounterRewards({
    encounterId: NORMAL_ENCOUNTER_ID,
    rewardIds: [101, 102],
    outcome: 'Fortune',
    avatarLevel: 1,
    getSolutionUses,
  });

  assert.deepEqual(rewards, [
    { solutionId: 101, quantity: 3 },
    { solutionId: 102, quantity: 3 },
  ]);
}

{
  const rewards = visibleEncounterRewards({
    encounterId: NORMAL_ENCOUNTER_ID,
    rewardIds: [101, 101],
    outcome: 'Fortune',
    avatarLevel: 1,
    getSolutionUses,
  });

  assert.deepEqual(rewards, [{ solutionId: 101, quantity: 6 }]);
}

{
  const rewards = visibleEncounterRewards({
    encounterId: NORMAL_ENCOUNTER_ID,
    prosperityRewardId: 201,
    rewardIds: [101],
    outcome: 'Prosperity',
    avatarLevel: 1,
    getSolutionUses,
  });

  assert.deepEqual(rewards, [
    { solutionId: 101, quantity: 3 },
    { solutionId: 201, quantity: 5 },
  ]);
}

{
  assert.equal(
    rewardQuantityForVisibleEntry({
      encounterId: 2,
      avatarLevel: 4,
      outcome: 'Fortune',
      solutionUses: 2,
    }),
    7,
  );
}

console.log('visibleEncounterRewards.test.ts: all assertions passed');
