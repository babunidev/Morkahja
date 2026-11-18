import assert from 'node:assert/strict';

import {
  LEVEL_UP_CHOICE_COUNT,
  levelUpChoiceIdsForAvatar,
  levelUpRolledRewardCount,
} from './encounterGenerator.js';
import { getSolutionMap } from './gameData.js';
import type { AvatarDocument } from '../types/avatar.js';

// D-049: one rolled reward per 5 on the d20, at most four, plus the chosen one.
const expected: Record<number, number> = {
  1: 0, 4: 0, 5: 1, 9: 1, 10: 2, 14: 2, 15: 3, 19: 3, 20: 4, 27: 4, [-2]: 0,
};
for (const [roll, count] of Object.entries(expected)) {
  assert.equal(levelUpRolledRewardCount(Number(roll)), count, `roll ${roll}`);
}

// Three different choices, all from the avatar's race and role reward types.
const avatar = { race: 'Rokur', role: 'Warrior', profile: {} } as unknown as AvatarDocument;
const solutions = getSolutionMap();
for (let run = 0; run < 50; run += 1) {
  const rolled = levelUpChoiceIdsForAvatar(avatar).slice(0, 2);
  const choices = levelUpChoiceIdsForAvatar(avatar, rolled);
  assert.equal(choices.length, LEVEL_UP_CHOICE_COUNT);
  assert.equal(new Set(choices).size, LEVEL_UP_CHOICE_COUNT, 'the choices differ');
  for (const id of choices) {
    const type = solutions[String(id)]?.mSolutionRewardType;
    assert.ok(type === 38 || (type !== undefined && type >= 40 && type <= 43), `choice ${id} is a race or Warrior reward (type ${type})`);
    assert.ok(!rolled.includes(id), 'a choice avoids the rolled rewards');
  }
}
assert.deepEqual(levelUpChoiceIdsForAvatar(undefined), []);

console.log('levelUpChoice.test.ts passed');
