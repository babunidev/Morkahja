import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import {
  ATRANOR_AMBIANCE_PACK,
  ambianceLandIsContinuous,
  gameClipPath,
  LEVEL_UP_AMBIANCE_PACK,
  placeDropFiles,
} from './ambianceDrop.js';

const sample = placeDropFiles([
  '0nature12.mp3',
  '0wind1.mp3',
  '0rainStart2.mp3',
  '0rain2.mp3',
  '1stageA1.mp3',
  '11nature1.mp3',
  '1stageB1.mp3',
  '1wind1.mp3',
  'notes.txt',
]);

assert.deepEqual(sample.unknown, []);
const samplePaths = new Map(sample.placed.map((placement) => [placement.sourceName, gameClipPath(placement)]));
assert.equal(samplePaths.get('1stageA1.mp3'), '/UI/Ambiance/1/stageA/1.mp3');
const atranor = placeDropFiles(['atranor_a1.mp3', 'atranor_d4.mp3']);
assert.deepEqual(atranor.unknown, []);
assert.equal(gameClipPath(atranor.placed[0]!), '/UI/Ambiance/atranor/stageA/1.mp3');
assert.equal(gameClipPath(atranor.placed[1]!), '/UI/Ambiance/atranor/stageD/4.mp3');
assert.equal(atranor.placed[1]!.expansion, ATRANOR_AMBIANCE_PACK);
const levelUp = placeDropFiles(['levelup_c2.mp3']).placed[0]!;
assert.equal(levelUp.expansion, LEVEL_UP_AMBIANCE_PACK);
assert.equal(gameClipPath(levelUp), '/UI/Ambiance/levelup/stageC/2.mp3');
assert.equal(ambianceLandIsContinuous(ATRANOR_AMBIANCE_PACK), true);
assert.equal(ambianceLandIsContinuous(LEVEL_UP_AMBIANCE_PACK), true);
assert.equal(ambianceLandIsContinuous(0), false);
assert.equal(ambianceLandIsContinuous(1), false);
assert.equal(placeDropFiles(['3stageC12.mp3']).placed[0]?.expansion, 3);
assert.equal(gameClipPath(placeDropFiles(['3stageC12.mp3']).placed[0]!), '/UI/Ambiance/3/stageC/12.mp3');
assert.equal(samplePaths.get('1stageB1.mp3'), '/UI/Ambiance/1/stageB/1.mp3');
assert.equal(samplePaths.get('0nature12.mp3'), '/UI/Ambiance/0/stageA/12.mp3');
assert.equal(samplePaths.get('0wind1.mp3'), '/UI/Ambiance/0/stageB/1.mp3');
assert.equal(samplePaths.get('0rainStart2.mp3'), '/UI/Ambiance/0/stageC/2.mp3');
assert.equal(samplePaths.get('0rain2.mp3'), '/UI/Ambiance/0/stageD/2.mp3');
assert.equal(samplePaths.get('11nature1.mp3'), '/UI/Ambiance/1/stageA/2.mp3');
assert.equal(samplePaths.get('1wind1.mp3'), '/UI/Ambiance/1/stageB/2.mp3');

const dropFolder = '/home/babuni/Projects/Assets/Morkahja/SFX/ambient';
if (existsSync(dropFolder)) {
  const names = readdirSync(dropFolder).filter((name) => name.endsWith('.mp3'));
  const { placed, unknown } = placeDropFiles(names);
  assert.deepEqual(unknown, []);
  const counts = new Map<string, number>();
  for (const placement of placed) {
    const key = `${placement.expansion}${placement.stage}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.get('0A'), 33);
  assert.equal(counts.get('0B'), 10);
  assert.equal(counts.get('0C'), 7);
  assert.equal(counts.get('0D'), 11);
  assert.equal(counts.get('1A'), 14);
  assert.equal(counts.get('1B'), 8);
  assert.equal(counts.get('1C'), 8);
  assert.equal(counts.get('1D'), 13);
  assert.equal(counts.get('3A'), 16);
  assert.equal(counts.get('3B'), 16);
  assert.equal(counts.get('3C'), 12);
  assert.equal(counts.get('3D'), 13);
  assert.equal(counts.get('4A'), 12);
  assert.equal(counts.get('4B'), 16);
  assert.equal(counts.get('4C'), 12);
  assert.equal(counts.get('4D'), 12);
  for (const stage of ['A', 'B', 'C', 'D']) {
    assert.equal(counts.get(`999${stage}`), 4);
    assert.equal(counts.get(`998${stage}`), 4);
  }
  assert.equal(counts.size, 24);
  const bySource = new Map(placed.map((placement) => [placement.sourceName, placement.number]));
  assert.equal(bySource.get('11nature1.mp3'), 12);
  assert.equal(bySource.get('11nature3.mp3'), 14);
  assert.equal(bySource.get('1wind1.mp3'), 5);
  assert.equal(bySource.get('1wind4.mp3'), 8);
}

assert.equal(
  placeDropFiles(['stray.mp3']).unknown[0],
  'stray.mp3',
);
