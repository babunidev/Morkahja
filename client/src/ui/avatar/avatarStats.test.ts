import assert from 'node:assert/strict';

import { distinctHeld } from './avatarStats.js';

// Each different item or skill once, not its charges (Babuni, 2026-11-24).
assert.equal(distinctHeld(undefined), 0);
assert.equal(distinctHeld([]), 0);
assert.equal(distinctHeld([{ solutionId: 1, uses: 5 }, { solutionId: 2, uses: 1 }]), 2);
// The same item in two entries counts once.
assert.equal(distinctHeld([{ solutionId: 1, uses: 2 }, { solutionId: 1, uses: 3 }]), 1);
// No charges left: not held.
assert.equal(distinctHeld([{ solutionId: 1, uses: 0 }, { solutionId: 2, uses: 4 }]), 1);

console.log('avatarStats.test.ts: all assertions passed');
