import assert from 'node:assert/strict';

import {
  createEncounterRollSnapshot,
  resolveEncounter,
} from './encounterResolver.js';
import type { EncounterData, EncounterDifficulty, SolutionDataMap } from './types.js';

const solutionMap: SolutionDataMap = {
  '10': {
    mSolutionID: 10,
    mSolutionType: 5,
    mSolutionName: 'Primary A',
    mSolutionIconName: 'test_primary',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 1,
    mSolutionText: 'Test solution',
    mSolutionUses: 1,
  },
  '20': {
    mSolutionID: 20,
    mSolutionType: 5,
    mSolutionName: 'Secondary low',
    mSolutionIconName: 'test_secondary_low',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 1,
    mSolutionText: 'Test solution',
    mSolutionUses: 1,
  },
  '21': {
    mSolutionID: 21,
    mSolutionType: 5,
    mSolutionName: 'Secondary high',
    mSolutionIconName: 'test_secondary_high',
    mSolutionInventoryType: 1,
    mSolutionRewardType: 1,
    mSolutionText: 'Test solution',
    mSolutionUses: 1,
  },
};

function baseEncounter(difficulty: EncounterDifficulty): EncounterData {
  return {
    mEncounterID: 1,
    mEncounterTitle: 'Charge test',
    mEncounterDifficulty: difficulty,
    mEncounterExpansion: 0,
    mEncounterFollow: 0,
    mEncounterImageName: 'test_encounter',
    mEncounterText: 'Test encounter',
    mEncounterType: 2,
    mEncounterRewardType: 1,
    mEncounterRewardAmount: 0,
    mEncounterSolutiuonA: 10,
    mEncounterSolutiuonTypeA: 5,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeD: 0,
  } satisfies EncounterData;
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

// Solution sets (D-019): each chosen solution rolls on its own; the rolls are
// averaged, and the dice stands in for each missing solution.
{
  const setRolls = createEncounterRollSnapshot({
    ...favorableRolls,
    rollPrimaryA: 90,
    rollSecondaryB: 60,
    rollE: 20,
    extraRolls: {
      primary: { A: [70, 80, 100], B: [61, 61, 61], C: [61, 61, 61], D: [61, 61, 61] },
      secondary: { A: [50, 50, 50], B: [50, 50, 50], C: [50, 50, 50], D: [50, 50, 50] },
    },
  });
  const encounter = {
    ...baseEncounter(3),
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonTypeB: 5,
  };

  // Two copies of A and an alternative in B: (90 + 70 + 60) / 3 = 73 → success.
  const full = resolveEncounter(encounter, [10, 10, 20], solutionMap, setRolls, {
    mode: 'slot', slot: 'A', picks: ['A', 'A', 'B'],
  });
  assert.equal(full.success, true);
  assert.equal(full.selectedRoll, 73);
  assert.deepEqual(full.usedInventorySolutions, [10, 10, 20]);

  // One item and the dice for the two missing: (90 + 20 + 20) / 3 = 43 → fails, the item is still spent.
  const diceFilled = resolveEncounter(encounter, [10], solutionMap, setRolls, {
    mode: 'slot', slot: 'A', picks: ['A'], diceFill: true,
  });
  assert.equal(diceFilled.success, false);
  assert.equal(diceFilled.selectedRoll, 43);
  assert.deepEqual(diceFilled.usedInventorySolutions, [10]);

  // An incomplete set without the dice, or more picks than needed, is not valid.
  const incomplete = resolveEncounter(encounter, [10, 10, 20], solutionMap, setRolls, {
    mode: 'slot', slot: 'A', picks: ['A', 'B'],
  });
  assert.equal(incomplete.success, false);
  assert.deepEqual(incomplete.usedInventorySolutions, []);
  const tooMany = resolveEncounter(encounter, [10, 10, 10, 20], solutionMap, setRolls, {
    mode: 'slot', slot: 'A', picks: ['A', 'A', 'A', 'B'],
  });
  assert.deepEqual(tooMany.usedInventorySolutions, []);

  // A copy the inventory does not hold is not valid either (one item 10, tapped twice).
  const missingCopy = resolveEncounter(encounter, [10], solutionMap, setRolls, {
    mode: 'slot', slot: 'A', picks: ['A', 'A'], diceFill: true,
  });
  assert.equal(missingCopy.success, false);
  assert.deepEqual(missingCopy.usedInventorySolutions, []);

  // An alternative never takes the item a primary pick needs: A primary 10 and
  // B's alternative type 5 with only [10, 21] in the inventory.
  const shared = resolveEncounter(encounter, [10, 21], solutionMap, setRolls, {
    mode: 'slot', slot: 'B', picks: ['B', 'A'], diceFill: true,
  });
  assert.deepEqual(shared.usedInventorySolutions, [21, 10]);
}

// Snapshots from before solution sets have no extra rolls: copies reuse the slot's roll.
{
  const result = resolveEncounter(baseEncounter(2), [10, 10], solutionMap, createEncounterRollSnapshot({
    ...favorableRolls,
    rollPrimaryA: 70,
  }), { mode: 'slot', slot: 'A', picks: ['A', 'A'] });
  assert.equal(result.selectedRoll, 70);
  assert.equal(result.success, true);
}

// Each chosen solution's own roll is reported with the result (D-024).
{
  const rolls = createEncounterRollSnapshot({
    ...favorableRolls,
    rollPrimaryA: 90,
    rollE: 20,
    extraRolls: {
      primary: { A: [70, 80, 61], B: [61, 61, 61], C: [61, 61, 61], D: [61, 61, 61] },
      secondary: { A: [50, 50, 50], B: [50, 50, 50], C: [50, 50, 50], D: [50, 50, 50] },
    },
  });
  const full = resolveEncounter(baseEncounter(3), [10, 10, 10], solutionMap, rolls, {
    mode: 'slot', slot: 'A', picks: ['A', 'A', 'A'],
  });
  assert.deepEqual(full.pickRolls, [90, 70, 80]);
  assert.equal(full.diceFillRoll, undefined);
  const withDice = resolveEncounter(baseEncounter(3), [10], solutionMap, rolls, {
    mode: 'slot', slot: 'A', picks: ['A'], diceFill: true,
  });
  assert.deepEqual(withDice.pickRolls, [90]);
  assert.equal(withDice.diceFillRoll, 20);
  const single = resolveEncounter(baseEncounter(1), [10], solutionMap, rolls, { mode: 'slot', slot: 'A' });
  assert.equal(single.pickRolls, undefined);
}
