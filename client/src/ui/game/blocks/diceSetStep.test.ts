import assert from 'node:assert/strict';

import { nextSetDiceRoll } from '@shared/solutionSet';

assert.equal(nextSetDiceRoll(1, 0, 0), 'ignore');
assert.equal(nextSetDiceRoll(2, 0, 0), 'hover');
assert.equal(nextSetDiceRoll(2, 0, 1), 'commit-dice');
assert.equal(nextSetDiceRoll(2, 1, 0), 'commit-mixed');
assert.equal(nextSetDiceRoll(3, 1, 0), 'hover');
assert.equal(nextSetDiceRoll(3, 1, 1), 'commit-mixed');
assert.equal(nextSetDiceRoll(3, 0, 2), 'commit-dice');
assert.equal(nextSetDiceRoll(2, 2, 0), 'ignore');
assert.equal(nextSetDiceRoll(2, 0, 2), 'ignore');
