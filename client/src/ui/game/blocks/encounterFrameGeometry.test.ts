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
import { fractionAt, planPhase } from '../frameTimer.js';

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

test('a phase is one line: later steps re-time it from its current length, never restart it', () => {
  let ids = 0;
  const newId = (): number => ++ids;
  // Using a solution: the phase starts full, guessed to end at 7300.
  const used = planPhase(null, 'act:1', null, 0, 7300, false, newId)!;
  assert.equal(used.startFraction, 1);
  // Rewards start emerging at 2500 and need until 9000: same line, re-timed from what is left.
  const emerging = planPhase(used, 'act:1', null, 2500, 6500, false, newId)!;
  assert.equal(emerging.id, used.id);
  assert.ok(Math.abs(emerging.startFraction - fractionAt(used, 2500)) < 1e-9);
  assert.equal(emerging.planEnd, 9000);
  // A shorter guess does not cut the phase short...
  assert.equal(planPhase(emerging, 'act:1', null, 3000, 1000, false, newId), emerging);
  // ...but the step that knows the real end may.
  const exact = planPhase(emerging, 'act:1', null, 4000, 3000, true, newId)!;
  assert.equal(exact.planEnd, 7000);
  assert.equal(exact.id, used.id);
  assert.ok(fractionAt(exact, 4000) > 0 && fractionAt(exact, 7000) === 0);
  // The next phase starts a new, full line.
  const next = planPhase(exact, 'actions:2', null, 8000, 5000, false, newId)!;
  assert.notEqual(next.id, used.id);
  assert.equal(next.startFraction, 1);
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

test('panel and tooltip frames: the same lines, thinner, inside their outset', async () => {
  const { ENCOUNTER_FRAME, PANEL_FRAME, TOOLTIP_FRAME } = await import('./encounterFrameGeometry.js');
  for (const spec of [PANEL_FRAME, TOOLTIP_FRAME]) {
    assert.equal(spec.lines.length, ENCOUNTER_FRAME.lines.length);
    assert.deepEqual(spec.lines.map((line) => Boolean(line.gapped)), ENCOUNTER_FRAME.lines.map((line) => Boolean(line.gapped)));
    spec.lines.forEach((line, index) => {
      assert.ok(line.width <= ENCOUNTER_FRAME.lines[index]!.width, 'thinner or equal');
      assert.ok(line.offset + line.width / 2 <= spec.outset, 'inside the element');
      const leg = cornerLegAt(line.offset, spec.cut);
      assert.ok(Math.abs((spec.cut - (leg - 2 * line.offset)) / Math.SQRT2 - line.offset) < 1e-9, 'parallel cut');
    });
    const dashes = randomGapDashArray(300, undefined, spec.dashScale);
    for (let index = 1; index < dashes.length; index += 2) {
      assert.ok(dashes[index]! >= 2, 'gaps stay visible');
    }
  }
});
