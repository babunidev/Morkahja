import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import { gameClipPath, placeDropFiles } from './ambianceDrop.js';

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
assert.equal(placeDropFiles(['2stageC12.mp3']).placed[0]?.expansion, 2);
assert.equal(gameClipPath(placeDropFiles(['2stageC12.mp3']).placed[0]!), '/UI/Ambiance/2/stageC/12.mp3');
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
  assert.equal(counts.get('2A'), 16);
  assert.equal(counts.get('2B'), 16);
  assert.equal(counts.get('2C'), 12);
  assert.equal(counts.get('2D'), 13);
  assert.equal(counts.size, 12);
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
