import assert from 'node:assert/strict';

import { solutionRollBonus, specializationChangeCost } from '@shared/specialization.js';
import { createEncounterRollSnapshot, resolveEncounter, revealSolutionSetPicks } from './encounterResolver.js';
import type { EncounterData, SolutionDataMap } from './types.js';

// Specialization (D-056): +1 to every roll made with a skill of the chosen
// type, in any slot; nothing for items or other skill types.
const FIND = 5;
const solutionMap: SolutionDataMap = {
  '10': { mSolutionID: 10, mSolutionType: FIND, mSolutionName: 'Find skill', mSolutionIconName: 'skill', mSolutionInventoryType: 1, mSolutionRewardType: 1, mSolutionText: '', mSolutionUses: 1 },
  '11': { mSolutionID: 11, mSolutionType: FIND, mSolutionName: 'Find skill 2', mSolutionIconName: 'skill2', mSolutionInventoryType: 1, mSolutionRewardType: 1, mSolutionText: '', mSolutionUses: 1 },
  '30': { mSolutionID: 30, mSolutionType: 6, mSolutionName: 'Find item', mSolutionIconName: 'item', mSolutionInventoryType: 2, mSolutionRewardType: 1, mSolutionText: '', mSolutionUses: 1 },
  '40': { mSolutionID: 40, mSolutionType: FIND, mSolutionName: 'Legendary find skill', mSolutionIconName: 'skill_legendary', mSolutionInventoryType: 1, mSolutionRewardType: 1, mSolutionText: '', mSolutionUses: 1 },
};

function encounter(difficulty: 1 | 2, primaryA: number, secondaryTypeA: number): EncounterData {
  return {
    mEncounterID: 1, mEncounterTitle: 'Specialization test', mEncounterDifficulty: difficulty,
    mEncounterExpansion: 0, mEncounterFollow: 0, mEncounterImageName: 'test', mEncounterText: '',
    mEncounterType: 2, mEncounterRewardType: 1, mEncounterRewardAmount: 0,
    mEncounterSolutiuonA: primaryA, mEncounterSolutiuonTypeA: secondaryTypeA,
    mEncounterSolutiuonB: 0, mEncounterSolutiuonTypeB: 0, mEncounterSolutiuonC: 0,
    mEncounterSolutiuonTypeC: 0, mEncounterSolutiuonD: 0, mEncounterSolutiuonTypeD: 0,
  } satisfies EncounterData;
}

const rolls = createEncounterRollSnapshot({
  rollA: 11, rollB: 11, rollC: 11, rollD: 11,
  rollPrimaryA: 11, rollPrimaryB: 11, rollPrimaryC: 11, rollPrimaryD: 11,
  rollSecondaryA: 8, rollSecondaryB: 8, rollSecondaryC: 8, rollSecondaryD: 8,
  rollE: 5,
  extraRolls: {
    primary: { A: [13], B: [], C: [], D: [] },
    secondary: { A: [9], B: [], C: [], D: [] },
  },
});

// A primary skill of the specialized type: 11 + 1.
{
  const plain = resolveEncounter(encounter(1, 10, 0), [10], solutionMap, rolls, { mode: 'slot', slot: 'A' });
  const special = resolveEncounter(encounter(1, 10, 0), [10], solutionMap, rolls, { mode: 'slot', slot: 'A' }, [], [], FIND);
  assert.equal(plain.selectedRoll, 11);
  assert.equal(special.selectedRoll, 12);
  assert.deepEqual(special.usedSolutionRolls, [12]);
}

// A secondary skill of the type gets it too: 8 + 1.
{
  const special = resolveEncounter(encounter(1, 0, FIND), [11], solutionMap, rolls, { mode: 'slot', slot: 'A' }, [], [], FIND);
  assert.equal(special.selectedRoll, 9);
}

// Another specialization, or none, adds nothing.
{
  const other = resolveEncounter(encounter(1, 10, 0), [10], solutionMap, rolls, { mode: 'slot', slot: 'A' }, [], [], 9);
  assert.equal(other.selectedRoll, 11);
}

// An item whose type number sits next to the skill's gets nothing: items have equipment.
{
  assert.equal(solutionRollBonus(solutionMap['30'], 6), 0);
  assert.equal(solutionRollBonus(solutionMap['30'], FIND), 0);
}

// A rare skill of the type: +1 rare and +1 specialization.
{
  assert.equal(solutionRollBonus(solutionMap['40'], FIND), 2);
  assert.equal(solutionRollBonus(solutionMap['40'], null), 1);
}

// In a set each pick gets its own +1, and the revealed rolls match the resolution.
{
  const set = encounter(2, 10, 0);
  const revealed = revealSolutionSetPicks(set, [10, 10], solutionMap, rolls, ['A', 'A'], [], FIND);
  assert.deepEqual(revealed?.map((pick) => pick.roll), [12, 14]);
  const resolved = resolveEncounter(set, [10, 10], solutionMap, rolls, { mode: 'slot', slot: 'A', picks: ['A', 'A'] }, [], [], FIND);
  assert.deepEqual(resolved.pickRolls, [12, 14]);
}

// The dice get nothing.
{
  const dice = resolveEncounter(encounter(1, 10, 0), [10], solutionMap, rolls, { mode: 'dice' }, [], [], FIND);
  assert.equal(dice.selectedRoll, 5);
}

// The first choice is free; a change costs 1 gem.
assert.equal(specializationChangeCost(null), 0);
assert.equal(specializationChangeCost(undefined), 0);
assert.equal(specializationChangeCost(FIND), 1);
assert.equal(specializationChangeCost(12345), 0);

console.log('specializationRoll.test.ts: all assertions passed');
