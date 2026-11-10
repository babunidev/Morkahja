import assert from 'node:assert/strict';

import { isCommitMoment } from './actionRevealPhase.js';

// Server withholds rolls: the reveal moment must still commit.
assert.equal(isCommitMoment('commit', null), true);
assert.equal(isCommitMoment('commit', 14), true);
// The selection moment never commits, even if a roll were known.
assert.equal(isCommitMoment('select', null), false);
assert.equal(isCommitMoment('select', 7), false);
// Legacy callers without a phase.
assert.equal(isCommitMoment(undefined, 9), true);
assert.equal(isCommitMoment(undefined, null), false);

console.log('actionRevealPhase tests passed');
