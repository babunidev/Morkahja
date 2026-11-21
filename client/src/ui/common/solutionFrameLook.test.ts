import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESSENCE_ELEMENTS,
  PAINTED_FRAME_ZOOM,
  solutionFrameLookFor,
  solutionIconNameFromSrc,
  solutionPictureZoom,
  type SolutionFrameRecord,
} from './solutionFrameLook.js';

const solutions = JSON.parse(
  readFileSync(new URL('../../../../server/game/solutiondata.json', import.meta.url), 'utf8'),
) as Record<string, SolutionFrameRecord | null>;
// The tier and element alone: whether a picture is remade changes as Babuni uploads.
const byId = (id: number): SolutionFrameRecord => ({ ...solutions[String(id)]!, mSolutionIconFrameless: false });

// Skills and simple items get the standard frame.
assert.deepEqual(solutionFrameLookFor(byId(10001)), { tier: 'standard', element: null, frameless: false });
assert.deepEqual(solutionFrameLookFor(byId(10013)), { tier: 'standard', element: null, frameless: false });

// Every god's essence has an element, and every essence in the data is one of them.
assert.deepEqual(solutionFrameLookFor(byId(10040)), { tier: 'essence', element: 'fire', frameless: false });
assert.deepEqual(solutionFrameLookFor(byId(10122)), { tier: 'essence', element: 'water', frameless: false });
assert.deepEqual(solutionFrameLookFor(byId(10011)), { tier: 'essence', element: 'air', frameless: false });
assert.deepEqual(solutionFrameLookFor(byId(10036)), { tier: 'essence', element: 'earth', frameless: false });
const essences = Object.values(solutions).filter((record) => record?.mSolutionType === 15);
assert.equal(essences.length, Object.keys(ESSENCE_ELEMENTS).length);
for (const essence of essences) {
  assert.ok(ESSENCE_ELEMENTS[essence!.mSolutionID], `element for essence ${essence!.mSolutionID}`);
}

// Valuable items: the Atranor items, non-essences in the essence inventory, legendary weapons.
assert.equal(solutionFrameLookFor(byId(10015)).tier, 'rare');
assert.equal(solutionFrameLookFor(byId(10153)).tier, 'rare');
assert.equal(solutionFrameLookFor(byId(10107)).tier, 'rare');

// A remade picture is marked in its solution record, by Babuni Admin on upload.
assert.equal(solutionFrameLookFor({ ...byId(10001), mSolutionIconFrameless: true }).frameless, true);
assert.equal(solutionPictureZoom(solutionFrameLookFor({ ...byId(10001), mSolutionIconFrameless: true })), 1);
assert.equal(solutionPictureZoom(solutionFrameLookFor({ ...byId(10001), mSolutionIconFrameless: false })), PAINTED_FRAME_ZOOM);
// The remade pictures so far are marked in the data.
for (const icon of ['skill_learn', 'skill_buy', 'skill_lockpick', 'skill_search', '10247_pouch', 'tool_map_enchanted_glades', 'tool_map_fae_pastures', '10246_jar']) {
  assert.ok(
    Object.values(solutions).some((record) => record?.mSolutionIconName === icon && record.mSolutionIconFrameless === true),
    `${icon} is marked frameless`,
  );
}

assert.equal(solutionIconNameFromSrc('/game/solutionimages/skill_learn.webp'), 'skill_learn');
assert.equal(solutionIconNameFromSrc('/Morkahja/game/solutionimages/10040_fyraan.webp?v=2'), '10040_fyraan');
assert.equal(solutionIconNameFromSrc('/UI/dice.webp'), null);

console.log('solutionFrameLook.test.ts passed');
