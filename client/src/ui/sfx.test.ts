import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADD_ITEM_SOUNDS,
  ADD_SKILL_SOUNDS,
  ESSENCE_DEITY_SOUNDS,
  LOSE_ESSENCE_SOUNDS,
  pickLossSound,
  pickPickupSound,
  rewardPickupKind,
  rewardVoice,
} from './sfx.js';

const sfxDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/UI/SFX');

function fileName(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

assert.deepEqual(ADD_ITEM_SOUNDS.map(fileName), ['addItem1.mp3', 'addItem2.mp3', 'addItem3.mp3']);
assert.deepEqual(
  ADD_SKILL_SOUNDS.map(fileName),
  Array.from({ length: 10 }, (_, index) => `addSkill${index + 1}.mp3`),
);

assert.equal(pickPickupSound('item', () => 0), ADD_ITEM_SOUNDS[0]);
assert.equal(pickPickupSound('item', () => 0.999), ADD_ITEM_SOUNDS[2]);
assert.equal(pickPickupSound('skill', () => 0), ADD_SKILL_SOUNDS[0]);
assert.equal(pickPickupSound('skill', () => 0.999), ADD_SKILL_SOUNDS[9]);
assert.equal(pickPickupSound('item', () => 1), ADD_ITEM_SOUNDS[2]);
assert.equal(rewardPickupKind(1), 'skill');
assert.equal(rewardPickupKind(2), 'item');
assert.equal(rewardPickupKind(3), 'item');
assert.equal(rewardPickupKind(0), 'item');

assert.deepEqual(
  LOSE_ESSENCE_SOUNDS.map(fileName),
  ['looseEssence1.mp3', 'looseEssence2.mp3', 'looseEssence3.mp3', 'looseEssence4.mp3'],
);
assert.equal(pickLossSound(3, 15, () => 0), LOSE_ESSENCE_SOUNDS[0]);
assert.equal(pickLossSound(3, 15, () => 0.999), LOSE_ESSENCE_SOUNDS[3]);
assert.equal(pickLossSound(3, 15, () => 1), LOSE_ESSENCE_SOUNDS[3]);
assert.equal(pickLossSound(3, 77, () => 0), null);
assert.equal(pickLossSound(1, 15, () => 0), null);
assert.equal(pickLossSound(2, 15, () => 0), null);

const solutionsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../server/game/solutiondata.json',
);
const solutions = JSON.parse(readFileSync(solutionsPath, 'utf8')) as Record<string, {
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionType: number;
}>;

function deityToken(name: string): string {
  return name.replace(/['’]s\b/g, '').split(/\s+/)[0] ?? '';
}

const deityEssences = Object.values(solutions).filter((solution) => (
  solution.mSolutionInventoryType === 3 && solution.mSolutionType === 15
));
assert.equal(deityEssences.length, 12);
for (const essence of deityEssences) {
  const expected = `essence${deityToken(essence.mSolutionName)}.mp3`;
  assert.equal(
    fileName(ESSENCE_DEITY_SOUNDS[essence.mSolutionID] ?? ''),
    expected,
    `${essence.mSolutionID} ${essence.mSolutionName}`,
  );
}
assert.equal(Object.keys(ESSENCE_DEITY_SOUNDS).length, deityEssences.length);
assert.equal(fileName(rewardVoice(3, 10010, () => 0)), 'essenceAeriel.mp3');
assert.equal(fileName(rewardVoice(3, 10015, () => 0)), 'addItem1.mp3');
assert.equal(fileName(rewardVoice(1, 10001, () => 0)), 'addSkill1.mp3');

for (const url of [
  ...ADD_ITEM_SOUNDS,
  ...ADD_SKILL_SOUNDS,
  ...LOSE_ESSENCE_SOUNDS,
  ...Object.values(ESSENCE_DEITY_SOUNDS),
]) {
  const bytes = readFileSync(path.join(sfxDir, fileName(url)));
  assert.ok(bytes.length > 1000, `${fileName(url)} is missing or empty`);
  assert.equal(bytes.subarray(0, 3).toString('latin1'), 'ID3', `${fileName(url)} is not an mp3`);
}
