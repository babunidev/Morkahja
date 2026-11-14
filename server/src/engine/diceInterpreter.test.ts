import assert from 'node:assert/strict';
import {
  DICE_ROLL_BONUS,
  PRIMARY_SOLUTION_ROLL_BONUS,
  SECONDARY_SOLUTION_ROLL_BONUS,
  difficultyRollPenalty,
  displayRollAsD20 as sharedDisplayRollAsD20,
  finalizeRoll,
  formatRollNotation,
  interpretRoll as sharedInterpretRoll,
  isD20Face,
  isRollFavorable as sharedIsRollFavorable,
} from '@shared/diceInterpreter.js';
import {
  interpretRoll as serverInterpretRoll,
  isRollFavorable as serverIsRollFavorable,
} from './diceInterpreter.js';
import { generateEncounterRollSnapshot } from './encounterRollGenerator.js';

const BOUNDARY_SAMPLES: Array<{ roll: number; outcome: ReturnType<typeof sharedInterpretRoll> }> = [
  { roll: -2, outcome: 'Misery' },
  { roll: 0, outcome: 'Misery' },
  { roll: 1, outcome: 'Misery' },
  { roll: 2, outcome: 'Misery' },
  { roll: 3, outcome: 'Hardship' },
  { roll: 8, outcome: 'Hardship' },
  { roll: 9, outcome: 'Disengage' },
  { roll: 12, outcome: 'Disengage' },
  { roll: 13, outcome: 'Fortune' },
  { roll: 18, outcome: 'Fortune' },
  { roll: 19, outcome: 'Prosperity' },
  { roll: 20, outcome: 'Prosperity' },
  { roll: 21, outcome: 'Prosperity' },
  { roll: 26, outcome: 'Prosperity' },
  { roll: 27, outcome: 'Prosperity' },
];

for (const { roll, outcome } of BOUNDARY_SAMPLES) {
  assert.equal(sharedInterpretRoll(roll), outcome, `shared interpretRoll(${roll})`);
  assert.equal(serverInterpretRoll(roll), outcome, `server interpretRoll(${roll})`);
  assert.equal(
    sharedIsRollFavorable(roll),
    outcome === 'Fortune' || outcome === 'Prosperity',
    `isRollFavorable(${roll})`,
  );
  assert.equal(
    sharedIsRollFavorable(roll),
    serverIsRollFavorable(roll),
    `shared/server isRollFavorable(${roll})`,
  );
}

for (let roll = 1; roll <= 20; roll += 1) {
  assert.equal(sharedInterpretRoll(roll), serverInterpretRoll(roll), `roll ${roll}`);
  assert.equal(sharedDisplayRollAsD20(roll), roll, `displayRollAsD20(${roll})`);
  assert.equal(isD20Face(roll), true);
}

assert.equal(sharedDisplayRollAsD20(26), 26);
assert.equal(sharedDisplayRollAsD20(27), 27);
assert.equal(sharedDisplayRollAsD20(-2), -2);
assert.equal(sharedDisplayRollAsD20(96), 19);
assert.equal(isD20Face(27), false);

assert.equal(difficultyRollPenalty(1), 0);
assert.equal(difficultyRollPenalty(2), 1);
assert.equal(difficultyRollPenalty(3), 2);
assert.equal(difficultyRollPenalty(4), 3);
assert.equal(difficultyRollPenalty(7), 6);

assert.equal(PRIMARY_SOLUTION_ROLL_BONUS, 7);
assert.equal(SECONDARY_SOLUTION_ROLL_BONUS, 5);
assert.equal(DICE_ROLL_BONUS, 0);
assert.equal(finalizeRoll(1, PRIMARY_SOLUTION_ROLL_BONUS, 1), 8);
assert.equal(finalizeRoll(20, PRIMARY_SOLUTION_ROLL_BONUS, 1), 27);
assert.equal(finalizeRoll(19, PRIMARY_SOLUTION_ROLL_BONUS, 1), 26);
assert.equal(finalizeRoll(20, SECONDARY_SOLUTION_ROLL_BONUS, 1), 25);
assert.equal(finalizeRoll(1, SECONDARY_SOLUTION_ROLL_BONUS, 1), 6);
assert.equal(finalizeRoll(1, DICE_ROLL_BONUS, 4), -2);
assert.equal(finalizeRoll(20, DICE_ROLL_BONUS, 4), 17);
assert.equal(finalizeRoll(14, PRIMARY_SOLUTION_ROLL_BONUS, 2), 20);
assert.equal(formatRollNotation(DICE_ROLL_BONUS, 1), 'd20');
assert.equal(formatRollNotation(DICE_ROLL_BONUS, 2), 'd20-1');
assert.equal(formatRollNotation(DICE_ROLL_BONUS, 4), 'd20-3');
assert.equal(formatRollNotation(SECONDARY_SOLUTION_ROLL_BONUS, 1), 'd20+5');
assert.equal(formatRollNotation(PRIMARY_SOLUTION_ROLL_BONUS, 1), 'd20+7');
assert.equal(formatRollNotation(PRIMARY_SOLUTION_ROLL_BONUS, 2), 'd20+6');
assert.equal(formatRollNotation(SECONDARY_SOLUTION_ROLL_BONUS, 7), 'd20-1');

for (const difficulty of [1, 2, 4, 7]) {
  const penalty = difficultyRollPenalty(difficulty);
  const faces = generateEncounterRollSnapshot(difficulty);
  const lanes: Array<{ face: number; bonus: number }> = [
    { face: faces.rollPrimaryA, bonus: PRIMARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollPrimaryB, bonus: PRIMARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollPrimaryC, bonus: PRIMARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollPrimaryD, bonus: PRIMARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollSecondaryA, bonus: SECONDARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollSecondaryB, bonus: SECONDARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollSecondaryC, bonus: SECONDARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollSecondaryD, bonus: SECONDARY_SOLUTION_ROLL_BONUS },
    { face: faces.rollE, bonus: DICE_ROLL_BONUS },
  ];
  for (const { face, bonus } of lanes) {
    assert.equal(Number.isInteger(face), true, `difficulty ${difficulty} face ${face}`);
    assert.ok(face >= 1 + bonus - penalty && face <= 20 + bonus - penalty, `difficulty ${difficulty} face ${face}`);
    assert.notEqual(sharedInterpretRoll(face), null, `difficulty ${difficulty} face ${face}`);
  }
}

console.log('diceInterpreter.test.ts passed');
