import assert from 'node:assert/strict';
import test from 'node:test';

import { inventoryWithCollected, type CollectedSolutionInfo } from './collectedInventory.js';

const info: Record<number, CollectedSolutionInfo> = {
  10001: { mSolutionInventoryType: 1, mSolutionType: 1 },
  10005: { mSolutionInventoryType: 2, mSolutionType: 6 },
  10010: { mSolutionInventoryType: 3, mSolutionType: 15 },
};
const lookup = (solutionId: number) => info[solutionId];

const base = {
  spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
  items: [],
  essences: [{ solutionId: 10010, solutionType: 15, uses: 3 }],
};

test('a collected reward shows at once: a new item is added to its container', () => {
  const shown = inventoryWithCollected(base, [{ solutionId: 10005, quantity: 1, kind: 'reward' }], lookup);
  assert.deepEqual(shown?.items, [{ solutionId: 10005, solutionType: 6, uses: 1 }]);
  assert.deepEqual(base.items, [], 'the server inventory itself is not modified');
});

test('a collected reward tops up an existing stack', () => {
  const shown = inventoryWithCollected(base, [{ solutionId: 10001, quantity: 3, kind: 'reward' }], lookup);
  assert.equal(shown?.spellbook[0]?.uses, 5);
});

test('a collected loss removes charges and drops the item at zero', () => {
  const partial = inventoryWithCollected(base, [{ solutionId: 10010, quantity: 1, kind: 'loss' }], lookup);
  assert.equal(partial?.essences[0]?.uses, 2);
  const all = inventoryWithCollected(base, [{ solutionId: 10010, quantity: 3, kind: 'loss' }], lookup);
  assert.deepEqual(all?.essences, []);
});

test('without collected changes the server inventory is returned unchanged', () => {
  assert.equal(inventoryWithCollected(base, [], lookup), base);
});

test('unknown solutions are ignored rather than shown in the wrong place', () => {
  const shown = inventoryWithCollected(base, [{ solutionId: 99999, quantity: 1, kind: 'reward' }], lookup);
  assert.deepEqual(shown, base);
});
