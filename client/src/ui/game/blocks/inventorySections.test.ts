import assert from 'node:assert/strict';

import { inventorySections } from './inventorySections.js';

const records: Record<number, { mSolutionIconName: string; mSolutionInventoryType: number; mSolutionType: number }> = {
  1: { mSolutionIconName: 'tool_rope', mSolutionInventoryType: 2, mSolutionType: 2 },
  2: { mSolutionIconName: 'weapon_titanpike_legendary', mSolutionInventoryType: 2, mSolutionType: 4 },
  3: { mSolutionIconName: 'essence_fyraan', mSolutionInventoryType: 3, mSolutionType: 15 },
  4: { mSolutionIconName: 'atranor_item', mSolutionInventoryType: 2, mSolutionType: 77 },
  5: { mSolutionIconName: 'tool_torch', mSolutionInventoryType: 2, mSolutionType: 6 },
};
const entry = (solutionId: number) => ({ solutionId, solutionType: records[solutionId]!.mSolutionType });
const recordFor = (id: number) => records[id];
const ids = (sections: Array<Array<{ solutionId: number }>>) => sections.map((s) => s.map((e) => e.solutionId));

assert.deepEqual(
  ids(inventorySections([entry(3), entry(2), entry(1), entry(4), entry(5)], recordFor)),
  [[1, 5], [2, 4], [3]],
  'normal, then rare, then essences, each in the given order',
);
assert.deepEqual(ids(inventorySections([entry(1), entry(3)], recordFor)), [[1], [3]], 'no empty rare list');
assert.deepEqual(ids(inventorySections([entry(3)], recordFor)), [[3]]);
assert.deepEqual(ids(inventorySections([], recordFor)), []);

console.log('inventorySections.test.ts passed');
