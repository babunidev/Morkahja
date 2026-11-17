import assert from 'node:assert/strict';

import {
  AMBIANCE_FADE_IN_MS,
  AMBIANCE_FADE_OUT_MS,
  landCrossfade,
  handoffRunFor,
  openingRun,
  pickPiece,
  stepAfterPiece,
  type AmbianceRun,
} from './ambianceCycle.js';

assert.equal(AMBIANCE_FADE_IN_MS, 1000);
assert.equal(AMBIANCE_FADE_OUT_MS, 2000);

const handoff = landCrossfade();
assert.equal(handoff.fadeInMs, AMBIANCE_FADE_IN_MS);
assert.equal(handoff.fadeOutMs, AMBIANCE_FADE_OUT_MS);
assert.equal(handoff.fadeInDelayMs, 0);
assert.ok(handoff.fadeInDelayMs < handoff.fadeOutMs);

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}

// Every stage, the approach included, plays 1–4 pieces before the next roll (2026-11-17).
assert.equal(openingRun(() => 0).piecesLeft, 1);
assert.equal(openingRun(() => 0.999999).piecesLeft, 4);
assert.equal(openingRun(() => 0).stage, 'A');

const continued = stepAfterPiece({ stage: 'A', piecesLeft: 4 }, () => 0);
assert.equal(continued.gap, 'rest');
assert.equal(continued.restMs, 0);
assert.deepEqual(continued.next, { stage: 'A', piecesLeft: 3 });

assert.equal(stepAfterPiece({ stage: 'D', piecesLeft: 3 }, sequence([])).gap, 'crossfade');
assert.deepEqual(stepAfterPiece({ stage: 'D', piecesLeft: 3 }, sequence([])).next, {
  stage: 'D',
  piecesLeft: 2,
});

function finish(run: AmbianceRun, rolls: number[]) {
  return stepAfterPiece(run, sequence(rolls));
}

const towardWind = finish({ stage: 'A', piecesLeft: 1 }, [0.49, 0, 0]);
assert.equal(towardWind.gap, 'rest');
assert.deepEqual(towardWind.next, { stage: 'B', piecesLeft: 1 });

const stayCalm = finish({ stage: 'A', piecesLeft: 1 }, [0.5, 0, 0]);
assert.deepEqual(stayCalm.next, { stage: 'A', piecesLeft: 1 });

const windToCalm = finish({ stage: 'B', piecesLeft: 1 }, [0.49, 0, 0]);
assert.deepEqual(windToCalm.next, { stage: 'A', piecesLeft: 1 });

const windToApproach = finish({ stage: 'B', piecesLeft: 1 }, [0.5, 0]);
assert.equal(windToApproach.gap, 'rest');
assert.deepEqual(windToApproach.next, { stage: 'C', piecesLeft: 1 });

const approachToStorm = finish({ stage: 'C', piecesLeft: 1 }, [0.79, 0]);
assert.equal(approachToStorm.gap, 'crossfade');
assert.equal(approachToStorm.restMs, 0);
assert.deepEqual(approachToStorm.next, { stage: 'D', piecesLeft: 1 });

// The approach can now last several pieces, with a break between them.
const approachGoesOn = stepAfterPiece({ stage: 'C', piecesLeft: 3 }, () => 0);
assert.equal(approachGoesOn.gap, 'rest');
assert.deepEqual(approachGoesOn.next, { stage: 'C', piecesLeft: 2 });
for (const stage of ['A', 'B', 'C', 'D'] as const) {
  assert.equal(finish({ stage: 'B', piecesLeft: 1 }, [stage === 'A' ? 0 : 0.5, 0.999999]).next.piecesLeft <= 4, true);
}

const approachBackToWind = finish({ stage: 'C', piecesLeft: 1 }, [0.8, 0, 0]);
assert.equal(approachBackToWind.gap, 'rest');
assert.deepEqual(approachBackToWind.next, { stage: 'B', piecesLeft: 1 });

const stormToWind = finish({ stage: 'D', piecesLeft: 1 }, [0.49, 0, 0]);
assert.equal(stormToWind.gap, 'fade-out');
assert.deepEqual(stormToWind.next, { stage: 'B', piecesLeft: 1 });

const stormToCalm = finish({ stage: 'D', piecesLeft: 1 }, [0.5, 0, 0]);
assert.deepEqual(stormToCalm.next, { stage: 'A', piecesLeft: 1 });

assert.equal(pickPiece(['one'], 'one', () => 0), 'one');
assert.equal(pickPiece(['one', 'two'], 'one', () => 0), 'two');
assert.equal(pickPiece(['one', 'two', 'three'], 'two', () => 0.999), 'three');

for (let roll = 0; roll < 20; roll += 1) {
  const step = finish({ stage: 'B', piecesLeft: 1 }, [roll / 20, 0, 0]);
  assert.notEqual(step.next.stage, 'D');
}

// A new land continues the stage cycle instead of starting over at A (2026-11-17).
const every = () => true;
assert.deepEqual(handoffRunFor({ stage: 'D', piecesLeft: 3 }, every, sequence([])), { stage: 'D', piecesLeft: 2 });
assert.deepEqual(handoffRunFor({ stage: 'B', piecesLeft: 4 }, every, () => 0).stage, 'B');
assert.equal(handoffRunFor({ stage: 'A', piecesLeft: 1 }, every, sequence([0.1, 0]))?.stage, 'B');
assert.equal(handoffRunFor({ stage: 'C', piecesLeft: 1 }, every, sequence([0.5, 0]))?.stage, 'D');
assert.equal(handoffRunFor(null, every, () => 0)?.stage, 'A');
assert.equal(handoffRunFor({ stage: 'D', piecesLeft: 3 }, (stage) => stage === 'A', () => 0)?.stage, 'A');
assert.equal(handoffRunFor({ stage: 'D', piecesLeft: 3 }, () => false, () => 0), null);

// The local test cycle walks every stage in order, one piece each (2026-11-17).
{
  const { testStepAfterPiece } = await import('./ambianceCycle.js');
  let run: AmbianceRun = { stage: 'A', piecesLeft: 1 };
  const seen: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const step = testStepAfterPiece(run);
    seen.push(`${run.stage}>${step.next.stage}:${step.gap}`);
    run = step.next;
  }
  assert.deepEqual(seen, ['A>B:rest', 'B>C:rest', 'C>D:crossfade', 'D>A:fade-out', 'A>B:rest']);
}
