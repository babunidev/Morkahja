import assert from 'node:assert/strict';
import test from 'node:test';

import { motionForDiceSlot } from './diceSlotMotion.js';

test('hovering dice keep the slot upright', () => {
  const hiddenPose = { opacity: 0, transform: 'rotate(-12deg) scale(0.92)' };
  assert.deepEqual(motionForDiceSlot(hiddenPose, true), { opacity: 1 });
  assert.equal(motionForDiceSlot(hiddenPose, false), hiddenPose);
});
