import assert from 'node:assert/strict';

import {
  createEncounterRollSnapshot,
  resolveEncounter,
} from '../engine/encounterResolver.js';
import type { EncounterData } from '../engine/types.js';
import type { AvatarInventory } from '../types/avatar.js';
import {
  applyEncounterInventoryChanges,
  consumeSolutionFromInventoryState,
  flattenInventorySolutionIds,
} from './inventoryService.js';
import { getSolutionMap } from './gameData.js';

function countSolutionCharges(inventory: AvatarInventory, solutionId: number): number {
  return flattenInventorySolutionIds(inventory).filter((id) => id === solutionId).length;
}

function inventoryFromEntries(
  spellbook: Array<{ solutionId: number; uses: number }> = [],
  items: Array<{ solutionId: number; uses: number }> = [],
  essences: Array<{ solutionId: number; uses: number }> = [],
): AvatarInventory {
  const solutionMap = getSolutionMap();

  const toItems = (entries: Array<{ solutionId: number; uses: number }>) =>
    entries.map((entry) => ({
      solutionId: entry.solutionId,
      solutionType: solutionMap[String(entry.solutionId)]!.mSolutionType,
      uses: entry.uses,
    }));

  return {
    spellbook: toItems(spellbook),
    items: toItems(items),
    essences: toItems(essences),
  };
}

const favorableRolls = createEncounterRollSnapshot({
  rollA: 96,
  rollB: 96,
  rollC: 96,
  rollD: 96,
  rollPrimaryA: 96,
  rollPrimaryB: 96,
  rollPrimaryC: 96,
  rollPrimaryD: 96,
  rollSecondaryA: 96,
  rollSecondaryB: 96,
  rollSecondaryC: 96,
  rollSecondaryD: 96,
  rollE: 96,
});

const unfavorableRolls = createEncounterRollSnapshot({
  rollA: 10,
  rollB: 10,
  rollC: 10,
  rollD: 10,
  rollPrimaryA: 10,
  rollPrimaryB: 10,
  rollPrimaryC: 10,
  rollPrimaryD: 10,
  rollSecondaryA: 10,
  rollSecondaryB: 10,
  rollSecondaryC: 10,
  rollSecondaryD: 10,
  rollE: 10,
});

function primaryEncounter(primarySolutionId: number, difficulty = 2): EncounterData {
  return {
    mEncounterID: 20001,
    mEncounterTitle: 'Solution consumption test',
    mEncounterDifficulty: difficulty,
    mEncounterRewardType: 0,
    mEncounterRewardAmount: 0,
    mEncounterSolutiuonA: primarySolutionId,
    mEncounterSolutiuonTypeA: getSolutionMap()[String(primarySolutionId)]!.mSolutionType,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeD: 0,
  } as EncounterData;
}

function secondaryEncounter(secondaryType: number, difficulty = 2): EncounterData {
  return {
    mEncounterID: 20001,
    mEncounterTitle: 'Secondary consumption test',
    mEncounterDifficulty: difficulty,
    mEncounterRewardType: 0,
    mEncounterRewardAmount: 0,
    mEncounterSolutiuonA: 99999,
    mEncounterSolutiuonTypeA: secondaryType,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeD: 0,
  } as EncounterData;
}

{
  const inventory = inventoryFromEntries([
    { solutionId: 10001, uses: 1 },
    { solutionId: 10001, uses: 1 },
  ]);

  const after = consumeSolutionFromInventoryState(inventory, 10001, 2);
  assert.equal(countSolutionCharges(after, 10001), 0);
}

{
  const inventory = inventoryFromEntries([{ solutionId: 10001, uses: 3 }]);
  const flat = flattenInventorySolutionIds(inventory);
  const resolution = resolveEncounter(
    primaryEncounter(10001, 2),
    flat,
    getSolutionMap(),
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(resolution.success, true);
  assert.deepEqual(resolution.usedInventorySolutions, [10001, 10001]);

  const apply = applyEncounterInventoryChanges(
    inventory,
    resolution.usedInventorySolutions,
    [],
    resolution.success,
    null,
    2,
    1,
  );

  assert.equal(countSolutionCharges(apply.inventory, 10001), 1);
}

{
  const inventory = inventoryFromEntries(
    [],
    [{ solutionId: 10005, uses: 1 }, { solutionId: 10006, uses: 1 }],
  );
  const flat = flattenInventorySolutionIds(inventory);
  const resolution = resolveEncounter(
    secondaryEncounter(6, 2),
    flat,
    getSolutionMap(),
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(resolution.success, true);
  assert.deepEqual(resolution.usedInventorySolutions, [10005, 10006]);
  assert.equal(
    flattenInventorySolutionIds(
      applyEncounterInventoryChanges(
        inventory,
        resolution.usedInventorySolutions,
        [],
        true,
        null,
        2,
        1,
      ).inventory,
    ).length,
    0,
  );
}

{
  const inventory = inventoryFromEntries([{ solutionId: 10001, uses: 2 }]);
  const flat = flattenInventorySolutionIds(inventory);
  const resolution = resolveEncounter(
    primaryEncounter(10001, 2),
    flat,
    getSolutionMap(),
    unfavorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(resolution.success, false);
  assert.deepEqual(resolution.usedInventorySolutions, [10001, 10001]);

  const apply = applyEncounterInventoryChanges(
    inventory,
    resolution.usedInventorySolutions,
    [],
    false,
    'Hardship',
    2,
    1,
    { randomInt: () => 0 },
  );

  assert.equal(countSolutionCharges(apply.inventory, 10001), 0);
  assert.equal(resolution.usedInventorySolutions.length, 2);
}

{
  const inventory = inventoryFromEntries([{ solutionId: 10001, uses: 1 }]);
  const flat = flattenInventorySolutionIds(inventory);
  const resolution = resolveEncounter(
    primaryEncounter(10001, 2),
    flat,
    getSolutionMap(),
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(resolution.success, false);
  assert.deepEqual(resolution.usedInventorySolutions, []);

  const apply = applyEncounterInventoryChanges(
    inventory,
    resolution.usedInventorySolutions,
    [],
    false,
    'Hardship',
    2,
    1,
    { randomInt: () => 0 },
  );

  assert.equal(countSolutionCharges(apply.inventory, 10001), 1);
}

{
  const inventory = inventoryFromEntries([{ solutionId: 10001, uses: 2 }]);
  assert.throws(
    () => consumeSolutionFromInventoryState(inventory, 10001, 3),
    /missing 1 charge/,
  );
}

console.log('solutionConsumption.test.ts: all assertions passed');
