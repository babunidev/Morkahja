import assert from 'node:assert/strict';
import test from 'node:test';

import {
  atranorEssenceGodCount,
  isAtranorSurvivalRoll,
} from '@shared/deathEncounter.js';
import { atranorEssenceRewardIds } from './atranorEssenceReward.js';

test('Atranor: 7 survives, 6 does not', () => {
  assert.equal(isAtranorSurvivalRoll(6), false);
  assert.equal(isAtranorSurvivalRoll(7), true);
  assert.equal(isAtranorSurvivalRoll(-2), false);
  assert.equal(isAtranorSurvivalRoll(null), false);
});

test('Atranor: one god at 7, two at 14, three at 20 or more', () => {
  assert.equal(atranorEssenceGodCount(6, false), 0);
  assert.equal(atranorEssenceGodCount(7, false), 1);
  assert.equal(atranorEssenceGodCount(13, false), 1);
  assert.equal(atranorEssenceGodCount(14, false), 2);
  assert.equal(atranorEssenceGodCount(19, false), 2);
  assert.equal(atranorEssenceGodCount(20, false), 3);
  assert.equal(atranorEssenceGodCount(25, false), 3);
});

test('Atranor: an item brings all three, but still has to survive', () => {
  assert.equal(atranorEssenceGodCount(7, true), 3);
  assert.equal(atranorEssenceGodCount(12, true), 3);
  assert.equal(atranorEssenceGodCount(6, true), 0);
});

test('Atranor essences: different gods of the own element', () => {
  const own = [10038, 10039, 10040];
  const first = () => 0;
  assert.deepEqual(atranorEssenceRewardIds({ count: 1, ownEssenceIds: own, anyEssenceIds: [1, 2], pickIndex: first }), [10038]);
  assert.deepEqual(atranorEssenceRewardIds({ count: 2, ownEssenceIds: own, anyEssenceIds: [1, 2], pickIndex: first }), [10038, 10039]);
  const all = atranorEssenceRewardIds({ count: 3, ownEssenceIds: own, anyEssenceIds: [], pickIndex: (n) => n - 1 });
  assert.deepEqual([...all].sort(), own);
  assert.deepEqual(atranorEssenceRewardIds({ count: 0, ownEssenceIds: own, anyEssenceIds: [], pickIndex: first }), []);
});

test('Atranor essences: without an element, different essences of any element', () => {
  assert.deepEqual(
    atranorEssenceRewardIds({ count: 2, ownEssenceIds: [], anyEssenceIds: [10010, 10011, 10026], pickIndex: () => 0 }),
    [10010, 10011],
  );
});
