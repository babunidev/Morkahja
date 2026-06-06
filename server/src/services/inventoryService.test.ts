import assert from 'node:assert/strict';

import type { AvatarInventory } from '../types/avatar.js';
import {
  applyEncounterInventoryChanges,
  applyFailurePenaltyToInventoryState,
  flattenInventorySolutionIds,
} from './inventoryService.js';

function inventoryWith(
  essences: Array<{ solutionId: number; uses: number }>,
  items: Array<{ solutionId: number; uses: number }> = [],
): AvatarInventory {
  return {
    spellbook: [],
    items: items.map((entry) => ({
      solutionId: entry.solutionId,
      solutionType: 2,
      uses: entry.uses,
    })),
    essences: essences.map((entry) => ({
      solutionId: entry.solutionId,
      solutionType: 15,
      uses: entry.uses,
    })),
  };
}

const alwaysFirst = () => 0;

{
  const inventory = inventoryWith(
    [{ solutionId: 10010, uses: 1 }],
    [{ solutionId: 10012, uses: 1 }, { solutionId: 10007, uses: 2 }],
  );

  const result = applyFailurePenaltyToInventoryState(
    inventory,
    'Misery',
    2,
    { randomInt: alwaysFirst },
  );

  assert.deepEqual(result.lostSolutionIds, [10010, 10012, 10007]);
  assert.equal(
    flattenInventorySolutionIds(result.inventory).filter((id) => id === 10010).length,
    0,
    'single-charge essence stack should be removed',
  );
  assert.equal(
    flattenInventorySolutionIds(result.inventory).filter((id) => id === 10012).length,
    0,
    'single-charge item stack should be removed',
  );
  assert.equal(
    flattenInventorySolutionIds(result.inventory).filter((id) => id === 10007).length,
    1,
    'remaining item charge should stay in inventory',
  );
}

{
  const inventory = inventoryWith(
    [{ solutionId: 10010, uses: 1 }],
    [{ solutionId: 10012, uses: 1 }],
  );

  const result = applyFailurePenaltyToInventoryState(
    inventory,
    'Misery',
    2,
    { randomInt: alwaysFirst },
  );

  assert.deepEqual(result.lostSolutionIds, [10010, 10012]);
  assert.equal(flattenInventorySolutionIds(result.inventory).length, 0);
}

{
  const inventory = inventoryWith([{ solutionId: 10010, uses: 1 }]);
  const result = applyFailurePenaltyToInventoryState(
    inventory,
    'Hardship',
    2,
    { randomInt: alwaysFirst },
  );

  assert.deepEqual(result.lostSolutionIds, [10010]);
  assert.equal(flattenInventorySolutionIds(result.inventory).length, 0);
}

{
  const inventory = inventoryWith(
    [{ solutionId: 10010, uses: 1 }, { solutionId: 10011, uses: 2 }],
  );
  const result = applyFailurePenaltyToInventoryState(
    inventory,
    'Hardship',
    2,
    { randomInt: alwaysFirst },
  );

  assert.deepEqual(result.lostSolutionIds, [10010, 10011]);
  assert.equal(
    flattenInventorySolutionIds(result.inventory).filter((id) => id === 10011).length,
    1,
  );
}

{
  const inventory = inventoryWith(
    [{ solutionId: 10010, uses: 2 }],
    [{ solutionId: 10012, uses: 3 }],
  );

  const apply = applyEncounterInventoryChanges(
    inventory,
    [10012, 10012],
    [],
    false,
    'Misery',
    2,
    1,
    { randomInt: alwaysFirst },
  );

  assert.deepEqual(apply.lostInventorySolutions, [10010, 10010, 10012]);
  assert.equal(
    flattenInventorySolutionIds(apply.inventory).length,
    0,
    'encounter solution consumption should happen before failure penalties',
  );
}

console.log('inventoryService.test.ts: all assertions passed');
