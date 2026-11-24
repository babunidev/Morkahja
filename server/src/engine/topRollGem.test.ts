import assert from 'node:assert/strict';
import {
  D20_MAX,
  PRIMARY_SOLUTION_ROLL_BONUS,
  TOP_ROLL_TOTAL,
  isTopRoll,
} from '@shared/diceInterpreter.js';
import { RARE_SOLUTION_ROLL_BONUS } from '@shared/solutionRarity.js';
import { SPECIALIZATION_ROLL_BONUS } from '@shared/specialization.js';
import { topRollGemClaimKey } from '../services/topRollGem.js';

// The top roll follows the bonuses (Babuni, 2026-11-24). No skill is rare,
// so the rare +1 and the specialization +1 never add up on one roll.
assert.equal(
  TOP_ROLL_TOTAL,
  D20_MAX + PRIMARY_SOLUTION_ROLL_BONUS + Math.max(RARE_SOLUTION_ROLL_BONUS, SPECIALIZATION_ROLL_BONUS),
);
assert.equal(TOP_ROLL_TOTAL, 26);
assert.equal(isTopRoll(26), true);
assert.equal(isTopRoll(25), false);
assert.equal(isTopRoll(undefined), false);
assert.equal(isTopRoll(Number.NaN), false);

// One gem per player and roll; the lore gem's key is `${snapshotId}:${playerId}`.
assert.equal(topRollGemClaimKey('snap-1', 'p1'), 'top-roll:snap-1:p1');
assert.equal(topRollGemClaimKey('snap-1', 'p1', 2), 'top-roll:snap-1:2:p1');
assert.notEqual(topRollGemClaimKey('snap-1', 'p1'), 'snap-1:p1');
