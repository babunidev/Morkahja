import assert from 'node:assert/strict';

import type { AvatarInventory } from '../../api/http.js';
import { nextEmptyEquipSlot } from './equipmentSlots.js';

// Before the world and after an item breaks, the game asks for an item for
// each empty slot it can fill (Babuni, 2026-11-26).
const solutions = {
  1: { mSolutionInventoryType: 2, mSolutionType: 6 },
  2: { mSolutionInventoryType: 2, mSolutionType: 14 },
  3: { mSolutionInventoryType: 2, mSolutionType: 15 }, // an essence: never equipped
  4: { mSolutionInventoryType: 1, mSolutionType: 5 }, // a skill: never equipped
};
const inventory = (items: Array<[number, number]>, equipped: unknown[] = []): AvatarInventory => ({
  items: items.map(([solutionId, uses]) => ({ solutionId, uses })),
  spellbook: [],
  essences: [],
  equipped,
} as unknown as AvatarInventory);

assert.equal(nextEmptyEquipSlot(inventory([[1, 2], [2, 1]]), solutions), 0, 'both empty: the first slot asks');
assert.equal(nextEmptyEquipSlot(inventory([[1, 2], [2, 1]], [1]), solutions), 1, 'then the second');
assert.equal(nextEmptyEquipSlot(inventory([[1, 2], [2, 1]], [1, 2]), solutions), null, 'both filled: no question');
assert.equal(nextEmptyEquipSlot(inventory([[1, 2]], [1]), solutions), null, 'nothing left to put in the second slot');
assert.equal(nextEmptyEquipSlot(inventory([[3, 4]]), solutions), null, 'essences do not count');
assert.equal(nextEmptyEquipSlot(undefined, solutions), null);
// A broken item (no charge left) leaves its slot empty, so the slot asks again.
assert.equal(nextEmptyEquipSlot(inventory([[1, 0], [2, 1]], [1, 2]), solutions), null, 'item 1 broke, but nothing else to equip');
assert.equal(nextEmptyEquipSlot(inventory([[1, 0], [2, 1], [5, 1]], [1, 2]), { ...solutions, 5: { mSolutionInventoryType: 2, mSolutionType: 10 } }), 0, 'item 1 broke: its slot asks');

console.log('equipmentSlots.test.ts passed');
