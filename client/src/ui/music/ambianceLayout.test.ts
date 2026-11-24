import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AMBIANCE_CLIPS } from './ambianceCatalog.js';
import { ATRANOR_AMBIANCE_PACK, LEVEL_UP_AMBIANCE_PACK } from './ambianceDrop.js';
import { ambiancePackForExpansion, expansionHasClips } from './ambianceLibrary.js';

const ambianceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../public/UI/Ambiance',
);

function countFiles(expansion: string, stage: string): number {
  return readdirSync(path.join(ambianceDir, expansion, stage)).filter((name) => name.endsWith('.mp3')).length;
}

const expected: Record<string, number> = {
  '0A': 33,
  '0B': 10,
  '0C': 7,
  '0D': 11,
  '1A': 14,
  '1B': 8,
  '1C': 8,
  '1D': 13,
  '3A': 16,
  '3B': 16,
  '3C': 12,
  '3D': 13,
  '4A': 12,
  '4B': 16,
  '4C': 12,
  '4D': 12,
};

for (const stage of ['A', 'B', 'C', 'D']) {
  assert.equal(countFiles('atranor', `stage${stage}`), 4, `atranor ${stage}`);
  assert.equal(countFiles('levelup', `stage${stage}`), 4, `levelup ${stage}`);
}
assert.equal(expansionHasClips(AMBIANCE_CLIPS, LEVEL_UP_AMBIANCE_PACK), true);
assert.equal(ambiancePackForExpansion(ATRANOR_AMBIANCE_PACK), ATRANOR_AMBIANCE_PACK);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, ATRANOR_AMBIANCE_PACK), true);

for (const [key, count] of Object.entries(expected)) {
  assert.equal(countFiles(key[0]!, `stage${key[1]}`), count, key);
}

assert.equal(AMBIANCE_CLIPS.length, 245);
const expansions = new Set(AMBIANCE_CLIPS.map((clip) => clip.expansion));
assert.deepEqual([...expansions].sort((a, b) => a - b), [0, 1, 3, 4, LEVEL_UP_AMBIANCE_PACK, ATRANOR_AMBIANCE_PACK]);

assert.equal(ambiancePackForExpansion(0), 0);
assert.equal(ambiancePackForExpansion(1), 1);
assert.equal(ambiancePackForExpansion(1001), 1);
assert.equal(ambiancePackForExpansion(1004), 4);
assert.equal(ambiancePackForExpansion(1003), 3);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, ambiancePackForExpansion(1001)), true);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, ambiancePackForExpansion(1003)), true);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, ambiancePackForExpansion(1004)), true);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, ambiancePackForExpansion(1002)), false);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, 1001), false);
assert.equal(expansionHasClips(AMBIANCE_CLIPS, 1003), false);
