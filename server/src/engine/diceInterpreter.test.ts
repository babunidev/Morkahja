import assert from 'node:assert/strict';
import {
  displayRollAsD20 as sharedDisplayRollAsD20,
  interpretRoll as sharedInterpretRoll,
  isRollFavorable as sharedIsRollFavorable,
} from '@shared/diceInterpreter.js';
import {
  interpretRoll as serverInterpretRoll,
  isRollFavorable as serverIsRollFavorable,
} from './diceInterpreter.js';

const BOUNDARY_SAMPLES: Array<{ roll: number; outcome: ReturnType<typeof sharedInterpretRoll> }> = [
  { roll: 0, outcome: null },
  { roll: 1, outcome: 'Misery' },
  { roll: 10, outcome: 'Misery' },
  { roll: 11, outcome: 'Hardship' },
  { roll: 39, outcome: 'Hardship' },
  { roll: 40, outcome: 'Disengage' },
  { roll: 60, outcome: 'Disengage' },
  { roll: 61, outcome: 'Fortune' },
  { roll: 95, outcome: 'Fortune' },
  { roll: 96, outcome: 'Prosperity' },
  { roll: 100, outcome: 'Prosperity' },
  { roll: 101, outcome: null },
];

for (const { roll, outcome } of BOUNDARY_SAMPLES) {
  assert.equal(sharedInterpretRoll(roll), outcome, `shared interpretRoll(${roll})`);
  assert.equal(serverInterpretRoll(roll), outcome, `server interpretRoll(${roll})`);
  assert.equal(
    sharedIsRollFavorable(roll),
    serverIsRollFavorable(roll),
    `isRollFavorable(${roll})`,
  );
}

for (let roll = 1; roll <= 100; roll += 1) {
  assert.equal(sharedInterpretRoll(roll), serverInterpretRoll(roll), `roll ${roll}`);
  assert.equal(
    sharedIsRollFavorable(roll),
    serverIsRollFavorable(roll),
    `favorable roll ${roll}`,
  );
  const d20 = sharedDisplayRollAsD20(roll);
  assert.ok(d20 >= 1 && d20 <= 20, `displayRollAsD20(${roll}) = ${d20}`);
}

assert.equal(sharedDisplayRollAsD20(1), 1);
assert.equal(sharedDisplayRollAsD20(3), 1);
assert.equal(sharedDisplayRollAsD20(50), 10);
assert.equal(sharedDisplayRollAsD20(100), 20);

console.log('diceInterpreter.test.ts passed');
