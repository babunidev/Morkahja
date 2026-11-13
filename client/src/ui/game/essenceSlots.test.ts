import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getEssenceSlots,
  landEssenceInSlot,
  reserveEssenceSlot,
  syncEssenceSlots,
  syncedState,
  takeFromEssenceSlots,
} from './essenceSlots.js';

test('slots show up to five of the avatar’s essences, never more than it has', () => {
  assert.deepEqual(syncedState({ avatarId: null, filled: 0, incoming: 0 }, 'a', 7), { avatarId: 'a', filled: 5, incoming: 0 });
  assert.equal(syncedState({ avatarId: 'a', filled: 5, incoming: 0 }, 'a', 3).filled, 3);
  // The same avatar keeps its own count: an emptied slot waits for the next encounter.
  assert.equal(syncedState({ avatarId: 'a', filled: 4, incoming: 0 }, 'a', 7).filled, 4);
});

test('a loss empties the outermost filled slot, once per loss', () => {
  syncEssenceSlots('hero', 5);
  assert.deepEqual(takeFromEssenceSlots(1, 'loss:1'), [4], 'right outer slot first');
  assert.deepEqual(takeFromEssenceSlots(1, 'loss:1'), [], 'a re-render takes nothing');
  assert.deepEqual(takeFromEssenceSlots(2, 'loss:2'), [0, 3]);
  assert.equal(getEssenceSlots().filled, 2);
});

test('arriving essences fill free slots from the centre outward, then go to the inventory', () => {
  syncEssenceSlots('other', 1);
  assert.equal(getEssenceSlots().filled, 1);
  assert.equal(reserveEssenceSlot(), 1);
  assert.equal(getEssenceSlots().filled, 1, 'shown when it lands');
  landEssenceInSlot();
  assert.equal(getEssenceSlots().filled, 2);
  assert.equal(reserveEssenceSlot(), 3);
  assert.equal(reserveEssenceSlot(), 0);
  assert.equal(reserveEssenceSlot(), 4);
  assert.equal(reserveEssenceSlot(), null, 'all five taken: to the inventory');
});
