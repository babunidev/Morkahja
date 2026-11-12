import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRAME_LINES,
  FRAME_OUTSET_PX,
  cornerLegAt,
  octagonPerimeter,
  randomGapDashArray,
  timerSegments,
} from './encounterFrameGeometry.js';
import { replacesTimer } from '../frameTimer.js';

test('every line cuts its corners along the corner triangles (parallel 45° cuts)', () => {
  // The cut line of a line `offset` outside the picture is x + y = leg - 2*offset
  // in picture coordinates; parallel lines are offset by exactly offset*sqrt(2).
  for (const line of FRAME_LINES) {
    const leg = cornerLegAt(line.offset);
    const cutDistance = (12 - (leg - 2 * line.offset)) / Math.SQRT2;
    assert.ok(Math.abs(cutDistance - line.offset) < 1e-9, `offset ${line.offset}`);
  }
});

test('the frame stays within its outset', () => {
  for (const line of FRAME_LINES) {
    assert.ok(line.offset + line.width / 2 <= FRAME_OUTSET_PX);
  }
});

test('the gapped line is covered end to end, the same way every render', () => {
  const length = octagonPerimeter(500, 500, 4);
  const dashes = randomGapDashArray(length);
  assert.ok(dashes.reduce((sum, value) => sum + value, 0) >= length);
  assert.deepEqual(randomGapDashArray(length), dashes);
  for (let index = 1; index < dashes.length; index += 2) {
    assert.ok(dashes[index]! >= 3 && dashes[index]! <= 9, 'gaps stay small');
  }
});

test('the timer shrinks from both ends toward its target, clamped to the line', () => {
  assert.deepEqual(timerSegments(500, 250, 10), { left: { from: 10, to: 250 }, right: { from: 250, to: 490 } });
  assert.deepEqual(timerSegments(500, -40, 10).left, { from: 10, to: 10 });
  assert.deepEqual(timerSegments(500, 900, 10).right, { from: 490, to: 490 });
});

test('overlapping waits: the line follows the one that finishes last', () => {
  const running = { id: 1, target: null, startedAt: 0, durationMs: 1000 };
  assert.equal(replacesTimer(running, { startedAt: 200, durationMs: 500 }, 200), false);
  assert.equal(replacesTimer(running, { startedAt: 200, durationMs: 900 }, 200), true);
  assert.equal(replacesTimer(running, { startedAt: 1200, durationMs: 100 }, 1200), true, 'a finished wait never blocks');
  assert.equal(replacesTimer(null, { startedAt: 0, durationMs: 1 }, 0), true);
});

test('a selection ring with random gaps closes exactly and differs per item', async () => {
  const { randomRingDashArray, seedFromText } = await import('./encounterFrameGeometry.js');
  const grimnir = randomRingDashArray(seedFromText('Grimnir'));
  const total = grimnir.reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 100) < 0.05, `covers the circle once (${total})`);
  assert.ok(grimnir.length >= 8, 'several gaps');
  assert.deepEqual(randomRingDashArray(seedFromText('Grimnir')), grimnir);
  assert.notDeepEqual(randomRingDashArray(seedFromText('Rokur')), grimnir);
});
