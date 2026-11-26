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
  // Server resolution already includes prosperity essence — do not double-count.
  const rewards = visibleEncounterRewards({
    encounterId: NORMAL_ENCOUNTER_ID,
    prosperityRewardId: 201,
    rewardIds: [101, 201],
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

{
  const rewards = visibleEncounterRewards({
    encounterId: NORMAL_ENCOUNTER_ID,
    rewardIds: [101],
    outcome: 'Prosperity',
    avatarLevel: 1,
    getSolutionUses,
    rewardChargeBonus: { solutionId: 101, charges: 2 },
  });

  assert.deepEqual(rewards, [{ solutionId: 101, quantity: 5 }]);
}

console.log('visibleEncounterRewards.test.ts: all assertions passed');

// Atranor (D-055): the total decides. 7 or more shows the returned essences,
// two charges each (D-068); 6 or less shows none.
{
  const atranor = (roll: number) => visibleEncounterRewards({
    encounterId: 1,
    rewardIds: [10038, 10039],
    outcome: null,
    roll,
    avatarLevel: 3,
    getSolutionUses: () => 5,
  });
  assert.deepEqual(atranor(7), [{ solutionId: 10038, quantity: 2 }, { solutionId: 10039, quantity: 2 }]);
  assert.deepEqual(atranor(6), []);
}
