import assert from 'node:assert/strict';

import {
  createEncounterRollSnapshot,
  resolveEncounter,
} from './encounterResolver.js';
import type { EncounterData, SolutionDataMap } from './types.js';

const solutionMap: SolutionDataMap = {
  '10': {
    mSolutionID: 10,
    mSolutionType: 5,
    mSolutionName: 'Primary A',
    mSolutionIconName: 'test_primary',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 0,
    mSolutionUses: 1,
  },
  '20': {
    mSolutionID: 20,
    mSolutionType: 5,
    mSolutionName: 'Secondary low',
    mSolutionIconName: 'test_secondary_low',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 0,
    mSolutionUses: 1,
  },
  '21': {
    mSolutionID: 21,
    mSolutionType: 5,
    mSolutionName: 'Secondary high',
    mSolutionIconName: 'test_secondary_high',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 0,
    mSolutionUses: 1,
  },
};

function baseEncounter(difficulty: number): EncounterData {
  return {
    mEncounterID: 1,
    mEncounterTitle: 'Charge test',
    mEncounterDifficulty: difficulty,
    mEncounterRewardType: 0,
    mEncounterRewardAmount: 0,
    mEncounterSolutiuonA: 10,
    mEncounterSolutiuonTypeA: 5,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeD: 0,
  } as EncounterData;
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

{
  const result = resolveEncounter(
    baseEncounter(2),
    [10],
    solutionMap,
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(result.success, false);
  assert.deepEqual(result.usedInventorySolutions, []);
}

{
  const result = resolveEncounter(
    baseEncounter(2),
    [10, 10],
    solutionMap,
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.usedInventorySolutions, [10, 10]);
}

{
  const encounter = {
    ...baseEncounter(2),
    mEncounterSolutiuonA: 999,
    mEncounterSolutiuonTypeA: 5,
  };

  const result = resolveEncounter(
    encounter,
    [20, 21],
    solutionMap,
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.usedInventorySolutions, [20, 21]);
}

{
  const encounter = {
    ...baseEncounter(2),
    mEncounterSolutiuonA: 999,
    mEncounterSolutiuonTypeA: 5,
  };

  const result = resolveEncounter(
    encounter,
    [21],
    solutionMap,
    favorableRolls,
    { mode: 'slot', slot: 'A' },
  );

  assert.equal(result.success, false);
  assert.deepEqual(result.usedInventorySolutions, []);
}

console.log('encounterResolver.test.ts: all assertions passed');
