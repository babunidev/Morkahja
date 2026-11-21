import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESSENCE_ELEMENTS,
  solutionFrameLookFor,
  solutionIconNameFromSrc,
  type SolutionFrameRecord,
} from './solutionFrameLook.js';

const solutions = JSON.parse(
  readFileSync(new URL('../../../../server/game/solutiondata.json', import.meta.url), 'utf8'),
) as Record<string, SolutionFrameRecord | null>;
const byId = (id: number): SolutionFrameRecord => solutions[String(id)]!;

// Skills and simple items get the standard frame.
assert.deepEqual(solutionFrameLookFor(byId(10001)), { tier: 'standard', element: null });
assert.deepEqual(solutionFrameLookFor(byId(10013)), { tier: 'standard', element: null });

// Every god's essence has an element, and every essence in the data is one of them.
assert.deepEqual(solutionFrameLookFor(byId(10040)), { tier: 'essence', element: 'fire' });
assert.deepEqual(solutionFrameLookFor(byId(10122)), { tier: 'essence', element: 'water' });
assert.deepEqual(solutionFrameLookFor(byId(10011)), { tier: 'essence', element: 'air' });
assert.deepEqual(solutionFrameLookFor(byId(10036)), { tier: 'essence', element: 'earth' });
const essences = Object.values(solutions).filter((record) => record?.mSolutionType === 15);
assert.equal(essences.length, Object.keys(ESSENCE_ELEMENTS).length);
for (const essence of essences) {
  assert.ok(ESSENCE_ELEMENTS[essence!.mSolutionID], `element for essence ${essence!.mSolutionID}`);
}

// Valuable items: the Atranor items, non-essences in the essence inventory, legendary weapons.
assert.equal(solutionFrameLookFor(byId(10015)).tier, 'rare');
assert.equal(solutionFrameLookFor(byId(10153)).tier, 'rare');
assert.equal(solutionFrameLookFor(byId(10107)).tier, 'rare');

assert.equal(solutionIconNameFromSrc('/game/solutionimages/skill_learn.webp'), 'skill_learn');
assert.equal(solutionIconNameFromSrc('/Morkahja/game/solutionimages/10040_fyraan.webp?v=2'), '10040_fyraan');
assert.equal(solutionIconNameFromSrc('/UI/dice.webp'), null);

console.log('solutionFrameLook.test.ts passed');
