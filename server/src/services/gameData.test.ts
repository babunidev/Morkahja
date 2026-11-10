import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getEncounters,
  getGameContentBundle,
  getSolutionMap,
} from './gameData.js';

const encountersPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../game/encountersdata.json',
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The bundle carries every content kind and a stable ETag.
const first = getGameContentBundle();
const parsed = JSON.parse(first.body) as Record<string, unknown>;
assert.deepEqual(
  Object.keys(parsed).sort(),
  ['encounters', 'expansions', 'frames', 'portraits', 'solutions', 'version'],
);
assert.equal(first.etag, `"${parsed.version as string}"`);
assert.equal(
  Object.keys(parsed.solutions as object).length,
  Object.keys(getSolutionMap()).length,
);
assert.equal(getGameContentBundle().etag, first.etag, 'unchanged content keeps its ETag');

// An edit on disk goes live without a restart, and the ETag changes with it.
const original = readFileSync(encountersPath, 'utf8');
try {
  const edited = JSON.parse(original) as Record<string, { mEncounterTitle: string }>;
  const key = Object.keys(edited)[0]!;
  edited[key]!.mEncounterTitle = `${edited[key]!.mEncounterTitle} (reload test)`;
  writeFileSync(encountersPath, JSON.stringify(edited));
  await sleep(1_100);

  assert.match(getEncounters()[key]!.mEncounterTitle, /\(reload test\)$/);
  assert.notEqual(getGameContentBundle().etag, first.etag);

  // An invalid file on disk keeps serving the last good copy.
  writeFileSync(encountersPath, '{ not json');
  await sleep(1_100);
  assert.match(getEncounters()[key]!.mEncounterTitle, /\(reload test\)$/);
} finally {
  writeFileSync(encountersPath, original);
}

await sleep(1_100);
assert.equal(getGameContentBundle().etag, first.etag, 'restored content restores the ETag');

console.log('gameData.test.ts passed');
