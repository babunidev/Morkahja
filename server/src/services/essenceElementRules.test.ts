import assert from 'node:assert/strict';
import test from 'node:test';

import type { AvatarInventory } from '../types/avatar.js';
import { essenceElementOf } from '@shared/essenceElements.js';
import {
  applyFailurePenaltyToInventoryState,
  buildInitialAvatarSeedIds,
  consumeEssenceLossesState,
} from './inventoryService.js';
import { ownElementEssenceBonus } from '../engine/ownElementEssenceBonus.js';

// Fire (Rokur): 10040 Fyraan, 10038 Solriel. Water: 10122 Nereval. Air: 10010 Aeriel.
function essences(entries: Array<[number, number]>): AvatarInventory {
  return {
    spellbook: [],
    items: [],
    essences: entries.map(([solutionId, uses]) => ({ solutionId, solutionType: 15, uses })),
  };
}

const first = () => 0;

function count(inventory: AvatarInventory): number {
  return inventory.essences.reduce((total, item) => total + item.uses, 0);
}

test('every race starts with three essences of its own element', () => {
  for (const [raceRewardType, element] of [[40, 'fire'], [41, 'water'], [42, 'air'], [43, 'earth']] as const) {
    for (let run = 0; run < 20; run += 1) {
      const seed = buildInitialAvatarSeedIds({ raceRewardType, roleRewardType: 37 });
      const essenceIds = seed.filter((id) => essenceElementOf(id) !== null);
      assert.equal(essenceIds.length, 3, `race ${raceRewardType} gets three essences`);
      assert.ok(essenceIds.every((id) => essenceElementOf(id) === element), `race ${raceRewardType}: ${essenceIds}`);
    }
  }
});

test('one loss takes two essences of other elements before any of its own', () => {
  const result = consumeEssenceLossesState(essences([[10040, 2], [10122, 1], [10010, 2]]), 1, 'fire', first);
  assert.equal(result.lostSolutionIds.length, 2);
  assert.ok(result.lostSolutionIds.every((id) => essenceElementOf(id) !== 'fire'));
  assert.equal(result.inventory.essences.find((item) => item.solutionId === 10040)?.uses, 2);
});

test('the last essence of another element goes alone on a loss of one', () => {
  const result = consumeEssenceLossesState(essences([[10040, 2], [10122, 1]]), 1, 'fire', first);
  assert.deepEqual(result.lostSolutionIds, [10122]);
  assert.equal(count(result.inventory), 2);

  const next = consumeEssenceLossesState(result.inventory, 1, 'fire', first);
  assert.deepEqual(next.lostSolutionIds, [10040], 'then own essences at the normal rate');
  assert.equal(count(next.inventory), 1);
});

test('a loss of two with one foreign essence left takes it and one own essence', () => {
  const result = consumeEssenceLossesState(essences([[10040, 2], [10122, 1]]), 2, 'fire', first);
  assert.deepEqual(result.lostSolutionIds, [10122, 10040]);
  assert.equal(count(result.inventory), 1);
});

test('own essences alone are lost one per loss', () => {
  const result = consumeEssenceLossesState(essences([[10040, 1], [10038, 2]]), 2, 'fire', first);
  assert.equal(result.lostSolutionIds.length, 2);
  assert.equal(count(result.inventory), 1);
});

test('Hardship and Misery use the element rule when the avatar has an element', () => {
  const inventory = essences([[10040, 1], [10122, 1], [10010, 1]]);
  const hardship = applyFailurePenaltyToInventoryState(inventory, 'Hardship', 1, { randomInt: first, ownElement: 'fire' });
  assert.equal(hardship.lostSolutionIds.length, 2);
  assert.deepEqual(hardship.inventory.essences.map((item) => item.solutionId), [10040]);

  const without = applyFailurePenaltyToInventoryState(inventory, 'Hardship', 1, { randomInt: first });
  assert.equal(without.lostSolutionIds.length, 1, 'no element: one essence, as before');
});

test('the own-element essence bonus: 25 or higher, one chance in five, own essences only', () => {
  const own = [10038, 10039, 10040];
  const hit = (min: number) => min; // 1 on the chance roll, first essence
  const miss = (min: number, max: number) => max;
  assert.equal(ownElementEssenceBonus({ selectedRoll: 25, success: true, ownEssenceIds: own, randomInt: hit }), 10038);
  assert.equal(ownElementEssenceBonus({ selectedRoll: 27, success: true, ownEssenceIds: own, randomInt: hit }), 10038);
  assert.equal(ownElementEssenceBonus({ selectedRoll: 24, success: true, ownEssenceIds: own, randomInt: hit }), null);
  assert.equal(ownElementEssenceBonus({ selectedRoll: 26, success: false, ownEssenceIds: own, randomInt: hit }), null);
  assert.equal(ownElementEssenceBonus({ selectedRoll: 26, success: true, ownEssenceIds: own, randomInt: miss }), null);
  assert.equal(ownElementEssenceBonus({ selectedRoll: 26, success: true, ownEssenceIds: [], randomInt: hit }), null);
});
