import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chargesNotInSlots,
  essenceCharges,
  getEssenceSlots,
  landEssenceInSlot,
  reserveEssenceSlot,
  syncEssenceSlots,
  syncedState,
  takeFromEssenceSlots,
  type EssenceSlotState,
} from './essenceSlots.js';

const A = 10026;
const B = 10039;
const C = 10040;
const D = 10011;

const fresh: EssenceSlotState = { avatarId: null, slots: [null, null, null, null, null], incoming: [null, null, null, null, null] };
const inv = (...entries: Array<[number, number]>) => entries.map(([solutionId, uses]) => ({ solutionId, uses }));

test('charges count uses, not inventory entries', () => {
  assert.deepEqual(essenceCharges(inv([A, 1], [B, 2], [C, 0])), [A, B, B]);
});

test('slots show up to five of the avatar’s essences, from the centre outward', () => {
  assert.deepEqual(syncedState(fresh, 'a', [A, B, C]).slots, [null, B, A, C, null]);
  assert.deepEqual(syncedState(fresh, 'a', [A, B, C, D, A, B, C]).slots, [D, B, A, C, A]);
});

test('after a loss the remaining essences keep their slots and pictures', () => {
  // Babuni's report (2026-11-13): three essences, one lost, the other two changed pictures.
  syncEssenceSlots('hero', inv([A, 1], [B, 1], [C, 1]));
  assert.deepEqual(getEssenceSlots().slots, [null, B, A, C, null]);
  // The server lost A, the centre one: that slot empties, B and C stay where they are.
  assert.deepEqual(takeFromEssenceSlots(A, 1, 'loss:A'), [2]);
  assert.deepEqual(takeFromEssenceSlots(A, 1, 'loss:A'), [], 'a re-render takes nothing');
  assert.deepEqual(getEssenceSlots().slots, [null, B, null, C, null]);
  // The loss is collected, then the server's committed inventory arrives.
  syncEssenceSlots('hero', inv([B, 1], [C, 1]));
  assert.deepEqual(getEssenceSlots().slots, [null, B, null, C, null]);
});

test('an essence lost from beyond the five slots leaves every slot filled', () => {
  syncEssenceSlots('six', inv([A, 2], [B, 1], [C, 1], [D, 1], [10010, 1]));
  const before = getEssenceSlots().slots;
  assert.deepEqual(takeFromEssenceSlots(10010, 1, 'loss:not-in-slot'), []);
  assert.deepEqual(getEssenceSlots().slots, before);
});

test('a slot whose essence is gone empties; with fewer charges the outer slot goes first', () => {
  const current: EssenceSlotState = { avatarId: 'a', slots: [null, B, B, B, null], incoming: fresh.incoming };
  assert.deepEqual(syncedState(current, 'a', [B, B]).slots, [null, B, B, null, null]);
  // The same avatar keeps its own slots: an emptied slot waits for the next encounter.
  const emptied: EssenceSlotState = { avatarId: 'a', slots: [null, B, null, C, null], incoming: fresh.incoming };
  assert.deepEqual(syncedState(emptied, 'a', [A, B, C]).slots, [null, B, null, C, null]);
  assert.deepEqual(chargesNotInSlots(emptied, [A, B, C]), [A], 'the refill brings A, not B or C again');
});

test('a gained essence of a kind already held keeps its own slot after the commit', () => {
  // Second report: a gained essence switched pictures in the next encounter.
  syncEssenceSlots('gain', inv([A, 1], [B, 1], [C, 1]));
  const position = reserveEssenceSlot(B);
  assert.equal(position, 0);
  assert.deepEqual(getEssenceSlots().slots, [null, B, A, C, null], 'shown when it lands');
  landEssenceInSlot(position!);
  // The server stacks it: B×2.
  syncEssenceSlots('gain', inv([A, 1], [B, 2], [C, 1]));
  assert.deepEqual(getEssenceSlots().slots, [B, B, A, C, null]);
});

test('arriving essences fill free slots from the centre outward, then go to the inventory', () => {
  syncEssenceSlots('other', inv([A, 1]));
  assert.equal(reserveEssenceSlot(B), 1);
  assert.equal(reserveEssenceSlot(C), 3);
  assert.equal(reserveEssenceSlot(D), 0);
  assert.equal(reserveEssenceSlot(A), 4);
  assert.equal(reserveEssenceSlot(B), null, 'all five taken: to the inventory');
  landEssenceInSlot(3);
  assert.deepEqual(getEssenceSlots().slots, [null, null, A, C, null]);
});
